import { appPath } from "@/lib/app-path";
import {
  createContext,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { ActionIcon, Button, Group, Loader, TextInput } from "@mantine/core";
import { IconLink, IconRefresh, IconSearch, IconX } from "@tabler/icons-react";
import {
  Editor,
  EditorContent,
  NodeViewContent,
  NodeViewProps,
  NodeViewWrapper,
  ReactNodeViewRenderer,
  useEditorState,
} from "@tiptap/react";
import { Extension } from "@tiptap/core";
import { Collaboration, isChangeOrigin } from "@tiptap/extension-collaboration";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { Plugin } from "@tiptap/pm/state";
import {
  HocuspocusProvider,
  HocuspocusProviderWebsocket,
} from "@hocuspocus/provider";
import * as Y from "yjs";
import { useTranslation } from "react-i18next";
import { useSetAtom } from "jotai";
import { linkedSourceSaveStatesAtom } from "@/features/personal/save-status";
import { useCollabToken } from "@/features/auth/queries/auth-query";
import { getPageById } from "@/features/page/services/page-service";
import type { IPage } from "@/features/page/types/page.types";
import { searchSuggestions } from "@/features/search/services/search-service";
import { getCollaborationUrl } from "@/lib/config";
import { buildPageUrl } from "@/features/page/page.utils";
import { mainExtensions } from "@/features/editor/extensions/extensions";
import {
  BaseEmbed,
  normalizePersistenceSnapshot,
  UniqueID,
} from "@docmost/editor-ext";
import DatabaseView from "./database-view";
import {
  DatabaseChoice,
  databaseEditIsScoped,
  personalDatabases,
} from "./linked-database-utils";
import classes from "./linked-database.module.css";

type PendingLink = { page: IPage; database: DatabaseChoice };
type SourceViewOptions = {
  databaseId: string;
  view: string;
  setView: (view: string) => void;
};
const SourceOptions = createContext<SourceViewOptions | null>(null);

function SourceDatabaseView(props: NodeViewProps) {
  const options = useContext(SourceOptions);
  useEditorState({
    editor: props.editor,
    selector: ({ editor }) => editor.isEditable,
  });
  if (!options || props.node.attrs.id !== options.databaseId) {
    return (
      <NodeViewWrapper hidden contentEditable={false}>
        <NodeViewContent hidden />
      </NodeViewWrapper>
    );
  }
  // Presentation belongs to the reference. Title and row transactions still
  // target the original node in the authenticated source document.
  const shown = props.node.type.create(
    { ...props.node.attrs, view: options.view },
    props.node.content,
    props.node.marks,
  );
  return (
    <DatabaseView
      {...props}
      node={shown}
      updateAttributes={(attrs) => {
        if (typeof attrs.view === "string") options.setView(attrs.view);
        const sourceAttrs = { ...attrs };
        delete sourceAttrs.view;
        if (Object.keys(sourceAttrs).length)
          props.updateAttributes(sourceAttrs);
      }}
    />
  );
}

export default function LinkedDatabaseView({
  node,
  editor,
  updateAttributes,
}: NodeViewProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [pages, setPages] = useState<Partial<IPage>[]>([]);
  const [selectedPage, setSelectedPage] = useState<IPage | null>(null);
  const [pending, setPending] = useState<PendingLink | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);
  const [chooserReady, setChooserReady] = useState(false);
  const sourcePageId = String(
    node.attrs.sourcePageId || pending?.page.id || "",
  );
  const databaseId = String(node.attrs.databaseId || "");
  const editable = useEditorState({
    editor,
    selector: ({ editor }) => editor.isEditable,
  });

  useEffect(() => {
    // The slash insertion restores editor focus in an animation frame. Keep
    // the new form disabled until that queued focus has finished, so typing
    // immediately after insertion cannot move from this field into the page.
    let readyFrame = 0;
    const insertionFrame = requestAnimationFrame(() => {
      readyFrame = requestAnimationFrame(() => setChooserReady(true));
    });
    return () => {
      cancelAnimationFrame(insertionFrame);
      cancelAnimationFrame(readyFrame);
    };
  }, []);

  useEffect(() => {
    if (sourcePageId || !editable) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      setBusy(true);
      searchSuggestions({
        query,
        includePages: true,
        includeUsers: false,
        includeGroups: false,
        limit: 30,
      })
        .then((result) => {
          if (!cancelled) {
            setPages(result.pages || []);
            setError("");
          }
        })
        .catch(() => {
          if (!cancelled) setError(t("Failed to load pages"));
        })
        .finally(() => {
          if (!cancelled) setBusy(false);
        });
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, sourcePageId, editable, t]);

  const selectPage = async (id: string) => {
    setBusy(true);
    setError("");
    try {
      const page = await getPageById({ pageId: id });
      if (page.deletedAt) throw new Error("deleted");
      setSelectedPage(page);
    } catch {
      setError(t("The source page is unavailable or you do not have access."));
    } finally {
      setBusy(false);
    }
  };
  const databases = selectedPage
    ? personalDatabases(selectedPage.content as unknown as object)
    : [];
  const disconnect = () => {
    if (!editor.isEditable) return;
    updateAttributes({ sourcePageId: "", databaseId: "", view: "table" });
    setPending(null);
    setSelectedPage(null);
    setError("");
  };
  return (
    <NodeViewWrapper
      className={classes.reference}
      data-type="personalDatabaseReference"
      data-personal-database-reference
      contentEditable={false}
    >
      <div className={classes.toolbar}>
        <span>
          <IconLink size={13} /> {t("Linked database")}
        </span>
        <Group gap={4}>
          {sourcePageId && (
            <ActionIcon
              variant="subtle"
              color="gray"
              size="sm"
              aria-label={t("Refresh source")}
              onClick={() => setVersion((v) => v + 1)}
            >
              <IconRefresh size={14} />
            </ActionIcon>
          )}
          {sourcePageId && editable && (
            <ActionIcon
              variant="subtle"
              color="gray"
              size="sm"
              aria-label={t("Disconnect database")}
              onClick={disconnect}
            >
              <IconX size={14} />
            </ActionIcon>
          )}
        </Group>
      </div>
      {sourcePageId ? (
        <LinkedSource
          key={`${sourcePageId}:${version}`}
          hostPageId={String(editor.storage.pageId || "")}
          pageId={sourcePageId}
          databaseId={databaseId}
          pending={pending}
          hostEditable={editable}
          view={String(node.attrs.view || "table")}
          setView={(view) => {
            if (editor.isEditable) updateAttributes({ view });
          }}
          onLinked={(id) => {
            if (editor.isEditable)
              updateAttributes({ sourcePageId, databaseId: id, view: "table" });
          }}
        />
      ) : !editable ? (
        <p className={classes.message}>
          {t("Choose a database in edit mode.")}
        </p>
      ) : (
        <div className={classes.chooser}>
          <TextInput
            disabled={!chooserReady}
            leftSection={<IconSearch size={14} />}
            aria-label={t("Find source page")}
            placeholder={t("Find source page")}
            value={query}
            onChange={(e) => {
              setQuery(e.currentTarget.value);
              setSelectedPage(null);
            }}
            size="sm"
          />
          {busy && <Loader size="xs" />}
          {error && (
            <p className={`${classes.message} ${classes.error}`} role="alert">
              {error}
            </p>
          )}
          {selectedPage ? (
            <>
              <Group justify="space-between">
                <strong>{selectedPage.title || t("Untitled")}</strong>
                <Button
                  size="xs"
                  variant="subtle"
                  onClick={() => setSelectedPage(null)}
                >
                  {t("Back")}
                </Button>
              </Group>
              {databases.length ? (
                databases.map((database) => (
                  <button
                    type="button"
                    className={classes.choice}
                    disabled={!chooserReady}
                    key={`${database.id}:${database.ordinal}`}
                    onClick={() => setPending({ page: selectedPage, database })}
                  >
                    {database.title || t("Database")} · {database.ordinal + 1}
                  </button>
                ))
              ) : (
                <p className={classes.message}>
                  {t(
                    "This page has no database. Insert a database in the source page first.",
                  )}
                </p>
              )}
            </>
          ) : (
            pages.map((page) => (
              <button
                type="button"
                className={classes.choice}
                disabled={!chooserReady}
                key={page.id}
                onClick={() => selectPage(page.id)}
              >
                {page.title || t("Untitled")}
              </button>
            ))
          )}
        </div>
      )}
    </NodeViewWrapper>
  );
}

type SourceProps = {
  hostPageId: string;
  pageId: string;
  databaseId: string;
  pending: PendingLink | null;
  hostEditable: boolean;
  view: string;
  setView: (view: string) => void;
  onLinked: (id: string) => void;
};
function LinkedSource(props: SourceProps) {
  const { t } = useTranslation();
  const { data: token, refetch: refreshToken } = useCollabToken();
  const [page, setPage] = useState<IPage | null>(null);
  const [sourceEditor, setSourceEditor] = useState<Editor | null>(null);
  const [chosenId, setChosenId] = useState(props.databaseId);
  const [state, setState] = useState<
    "connecting" | "saving" | "saved" | "error"
  >("connecting");
  const [error, setError] = useState("");
  const [exists, setExists] = useState(false);
  const current = useRef(props);
  current.current = props;
  const sourceEditorRef = useRef<Editor | null>(null);
  const revision = useRef(0);
  const dirty = useRef(false);
  const [isDirty, setIsDirty] = useState(false);
  const chosen = useRef(props.databaseId);
  const permission = useRef(false);
  const connected = useRef(false);
  const instanceKey = useId();
  const setSourceSaveStates = useSetAtom(linkedSourceSaveStatesAtom);

  useEffect(() => {
    setSourceSaveStates((states) => ({
      ...states,
      [instanceKey]: {
        hostPageId: props.hostPageId,
        sourcePageId: props.pageId,
        state,
        dirty: isDirty,
      },
    }));
  }, [
    state,
    isDirty,
    props.hostPageId,
    props.pageId,
    instanceKey,
    setSourceSaveStates,
  ]);
  useEffect(
    () => () => {
      setSourceSaveStates((states) => {
        const next = { ...states };
        delete next[instanceKey];
        return next;
      });
    },
    [instanceKey, setSourceSaveStates],
  );

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (!dirty.current) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  useEffect(() => {
    if (!token?.token) return;
    setSourceEditor(null);
    setExists(false);
    setState("connecting");
    let cancelled = false;
    let provider: HocuspocusProvider | null = null;
    let socket: HocuspocusProviderWebsocket | null = null;
    let permissionTimer: ReturnType<typeof setInterval> | null = null;
    let pendingReceipt: { type: string; contentHash: string } | null = null;
    const failure = (message: string) => {
      if (cancelled) return;
      permission.current = false;
      sourceEditorRef.current?.setEditable(false);
      setError(message);
      setState("error");
      setExists(false);
    };
    const verifyPage = async () => {
      try {
        const fresh = await getPageById({ pageId: props.pageId });
        if (cancelled) return null;
        if (fresh.deletedAt) {
          failure(
            t("The source page is in trash. Restore it to use this view."),
          );
          return null;
        }
        permission.current =
          fresh.permissions?.canEdit === true && !fresh.isLocked;
        sourceEditorRef.current?.setEditable(
          permission.current &&
            current.current.hostEditable &&
            connected.current,
        );
        setPage(fresh);
        const live = sourceEditorRef.current;
        if (live && !live.isDestroyed && connected.current) {
          setError("");
          setExists(
            personalDatabases(live.getJSON()).filter(
              (database) => database.id === chosen.current,
            ).length === 1,
          );
          if (
            !dirty.current &&
            live.state.doc.eq(live.schema.nodeFromJSON(fresh.content))
          )
            setState("saved");
        }
        return fresh;
      } catch {
        failure(t("The source page is unavailable or you do not have access."));
        return null;
      }
    };
    const receiptMatches = async () => {
      if (!provider || !pendingReceipt || cancelled) return;
      const atRevision = revision.current;
      const receipt = pendingReceipt;
      const bytes = new Uint8Array(
        normalizePersistenceSnapshot(Y.encodeStateAsUpdate(provider.document)),
      );
      const digest = await crypto.subtle.digest("SHA-256", bytes);
      const hash = Array.from(new Uint8Array(digest), (byte) =>
        byte.toString(16).padStart(2, "0"),
      ).join("");
      if (
        cancelled ||
        atRevision !== revision.current ||
        hash !== receipt.contentHash
      )
        return;
      dirty.current = receipt.type !== "page.persisted";
      setIsDirty(dirty.current);
      setState(receipt.type === "page.persisted" ? "saved" : "error");
    };
    const connect = async () => {
      const fresh = await verifyPage();
      if (!fresh || cancelled) return;
      socket = new HocuspocusProviderWebsocket({ url: getCollaborationUrl() });
      provider = new HocuspocusProvider({
        websocketProvider: socket,
        name: `page.${props.pageId}`,
        token: token.token,
        onAuthenticationFailed: () => {
          failure(
            t("Source authentication failed. Refresh the source to reconnect."),
          );
          refreshToken();
        },
        onStatus: ({ status }) => {
          connected.current = status === "connected";
          if (cancelled) return;
          sourceEditorRef.current?.setEditable(
            permission.current &&
              current.current.hostEditable &&
              connected.current,
          );
          if (!connected.current)
            setState(dirty.current ? "error" : "connecting");
        },
        onStateless: ({ payload }) => {
          try {
            const message = JSON.parse(payload);
            if (
              message.pageId !== props.pageId ||
              !["page.persisted", "page.persist-failed"].includes(message.type)
            )
              return;
            pendingReceipt = message;
            receiptMatches().catch(() => {
              if (!cancelled) setState("error");
            });
          } catch {
            /* Unrelated collaboration message. */
          }
        },
        onSynced: async ({ state: synced }) => {
          if (!synced || cancelled || sourceEditorRef.current) return;
          const scope = { id: chosen.current };
          const isolate = Extension.create({
            name: "linkedDatabaseScope",
            addProseMirrorPlugins() {
              return [
                new Plugin({
                  filterTransaction: (tr, previous) =>
                    !tr.docChanged ||
                    isChangeOrigin(tr) ||
                    !scope.id ||
                    databaseEditIsScoped(
                      previous.doc.toJSON(),
                      tr.doc.toJSON(),
                      scope.id,
                    ),
                  props: {
                    decorations: (state) => {
                      const decorations: Decoration[] = [];
                      const visit = (node, pos: number) => {
                        if (
                          node.type.name === "personalDatabase" &&
                          node.attrs.id === scope.id
                        )
                          return;
                        let contains = false;
                        node.descendants((child) => {
                          if (
                            child.type.name === "personalDatabase" &&
                            child.attrs.id === scope.id
                          )
                            contains = true;
                        });
                        if (!contains) {
                          if (!node.isText)
                            decorations.push(
                              Decoration.node(pos, pos + node.nodeSize, {
                                style: "display:none",
                              }),
                            );
                          return;
                        }
                        node.forEach((child, offset) =>
                          visit(child, pos + offset + 1),
                        );
                      };
                      state.doc.forEach((node, pos) => visit(node, pos));
                      return DecorationSet.create(state.doc, decorations);
                    },
                    handleDOMEvents: {
                      beforeinput: (_view, event) => {
                        const target = event.target as HTMLElement;
                        if (target.closest("input,textarea,select"))
                          return false;
                        event.preventDefault();
                        return true;
                      },
                      keydown: (_view, event) => {
                        const target = event.target as HTMLElement;
                        if (target.closest("input,textarea,select,button"))
                          return false;
                        event.preventDefault();
                        return true;
                      },
                      paste: (_view, event) => {
                        if (
                          (event.target as HTMLElement).closest(
                            "input,textarea",
                          )
                        )
                          return false;
                        event.preventDefault();
                        return true;
                      },
                      drop: (_view, event) => {
                        event.preventDefault();
                        return true;
                      },
                    },
                  },
                }),
              ];
            },
          });
          const omitted = new Set([
            "uniqueID",
            "globalDragHandle",
            "slash-command",
            "angle-command",
            "emoji-command",
            "placeholder",
            "trailingNode",
            "autoJoiner",
            "base",
          ]);
          const extensions = mainExtensions
            .filter((extension) => !omitted.has(extension.name))
            .map((extension) => {
              if (extension.name === "personalDatabase")
                return extension.extend({
                  addNodeView: () => ReactNodeViewRenderer(SourceDatabaseView),
                });
              if (extension.type !== "node" || extension.name === "text")
                return extension;
              // No nested reference, media or embed views are mounted for the
              // hidden source page. This also prevents cyclic room recursion.
              return extension.extend({
                addNodeView() {
                  return ({ node }) => {
                    const dom = document.createElement(
                      node.isInline ? "span" : "div",
                    );
                    return {
                      dom,
                      ...(!node.isLeaf ? { contentDOM: dom } : {}),
                    };
                  };
                },
              });
            });
          const editor = new Editor({
            extensions: [
              ...extensions,
              // Preserve the CE compatibility schema for an existing Base
              // atom without inheriting or rendering the Enterprise view.
              BaseEmbed.extend({
                addCommands: () => ({}),
                addKeyboardShortcuts: () => ({}),
                addProseMirrorPlugins: () => [],
                addNodeView: () => () => ({
                  dom: document.createElement("div"),
                }),
              }),
              UniqueID.configure({
                types: ["heading", "paragraph", "transclusionSource"],
                updateDocument: false,
              }),
              isolate,
              Collaboration.configure({
                document: provider.document,
                provider,
              }),
            ],
            editable: permission.current && current.current.hostEditable,
            editorProps: {
              attributes: { "aria-label": t("Linked database source") },
            },
            onUpdate: ({ editor: updatedEditor, transaction }) => {
              if (!transaction.docChanged) return;
              revision.current++;
              setState("saving");
              if (!isChangeOrigin(transaction)) {
                dirty.current = true;
                setIsDirty(true);
              }
              setExists(
                personalDatabases(updatedEditor.getJSON()).filter(
                  (database) => database.id === scope.id,
                ).length === 1,
              );
            },
          });
          editor.storage.pageId = props.pageId;
          sourceEditorRef.current = editor;
          if (!scope.id && current.current.pending) {
            const expected = current.current.pending.database;
            let index = 0,
              selected: { node; pos: number } | null = null;
            editor.state.doc.descendants((node, pos) => {
              if (node.type.name !== "personalDatabase") return;
              if (index++ === expected.ordinal) selected = { node, pos };
              return false;
            });
            if (!selected || selected.node.attrs.title !== expected.title) {
              editor.destroy();
              sourceEditorRef.current = null;
              failure(t("The source database changed. Choose it again."));
              return;
            }
            let id = selected.node.attrs.id;
            const duplicateId =
              id &&
              personalDatabases(editor.getJSON()).filter(
                (database) => database.id === id,
              ).length > 1;
            if (!id || duplicateId) {
              if (!permission.current || !current.current.hostEditable) {
                editor.destroy();
                sourceEditorRef.current = null;
                failure(
                  t(
                    "You need edit access to the source to connect this database.",
                  ),
                );
                return;
              }
              id = crypto.randomUUID();
              editor.commands.command(({ tr }) => {
                tr.setNodeAttribute(selected.pos, "id", id);
                return true;
              });
            }
            scope.id = id;
            chosen.current = id;
            setChosenId(id);
            current.current.onLinked(id);
            editor.view.dispatch(editor.state.tr);
          }
          setSourceEditor(editor);
          setExists(
            personalDatabases(editor.getJSON()).filter(
              (database) => database.id === scope.id,
            ).length === 1,
          );
          // Initial synchronization is not a database acknowledgement. Compare
          // a fresh persisted document before showing Source saved.
          const atRevision = revision.current;
          const committed = await verifyPage();
          if (
            !cancelled &&
            committed &&
            atRevision === revision.current &&
            !editor.isDestroyed &&
            !dirty.current
          ) {
            setState(
              editor.state.doc.eq(editor.schema.nodeFromJSON(committed.content))
                ? "saved"
                : "saving",
            );
          }
          await receiptMatches();
        },
      });
      // Passing an existing websocket makes HocuspocusProvider 4's socket
      // management manual. Attach the source room explicitly.
      provider.attach();
      permissionTimer = setInterval(verifyPage, 15000);
    };
    connect().catch(() => failure(t("Failed to load the source database.")));
    const onFocus = () => {
      verifyPage();
    };
    window.addEventListener("focus", onFocus);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", onFocus);
      if (permissionTimer) clearInterval(permissionTimer);
      sourceEditorRef.current?.destroy();
      sourceEditorRef.current = null;
      provider?.destroy();
      socket?.destroy();
    };
  }, [props.pageId, token?.token, refreshToken, t]);

  useEffect(() => {
    sourceEditor?.setEditable(
      permission.current && props.hostEditable && connected.current,
    );
  }, [sourceEditor, props.hostEditable]);
  const sourceOptions = useMemo(
    () => ({ databaseId: chosenId, view: props.view, setView: props.setView }),
    [chosenId, props.view, props.setView],
  );
  const label =
    state === "saved"
      ? t("Source saved")
      : state === "saving"
        ? t("Saving source...")
        : state === "connecting"
          ? t("Connecting to source...")
          : t("Source save failed");
  const href = page?.space?.slug
    ? buildPageUrl(page.space.slug, page.slugId, page.title)
    : `/p/${props.pageId}`;
  return (
    <div>
      <div className={classes.toolbar}>
        <a href={appPath(href)}>{page?.title || t("Source page")} ↗</a>
        <span role="status" data-linked-save-state={state}>
          {label}
        </span>
      </div>
      {error ? (
        <p className={`${classes.message} ${classes.error}`} role="alert">
          {error}
        </p>
      ) : !sourceEditor ? (
        <Loader size="xs" />
      ) : !exists ? (
        <p className={classes.message}>
          {t(
            "The source database was removed. Choose another database or restore the source.",
          )}
        </p>
      ) : (
        <SourceOptions.Provider value={sourceOptions}>
          <div
            className={classes.source}
            onMouseDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.stopPropagation()}
            onDragStart={(event) => event.stopPropagation()}
            onDragOver={(event) => event.stopPropagation()}
            onDrop={(event) => event.stopPropagation()}
          >
            <EditorContent editor={sourceEditor} />
          </div>
        </SourceOptions.Provider>
      )}
    </div>
  );
}
