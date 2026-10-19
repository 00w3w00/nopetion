import { useDatabaseProperties } from "./database-properties";
import { useMemo, useState } from "react";
import { NodeViewContent, NodeViewProps, NodeViewWrapper } from "@tiptap/react";
import {
  ActionIcon,
  Button,
  Group,
  Modal,
  Select,
  Stack,
  TextInput,
} from "@mantine/core";
import {
  IconDownload,
  IconPlus,
  IconSearch,
  IconTrash,
} from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import {
  PERSONAL_DATABASE_VIEWS,
  PersonalRow,
  personalRowValues,
  personalRowsToCsv,
} from "@docmost/editor-ext";
import classes from "./database-view.module.css";
import { viewLabels, statusLabels } from "./presentation";
const fields = [
  "title",
  "status",
  "assignee",
  "date",
  "number",
  "location",
] as const;
const fieldLabels = {
  title: "Name",
  status: "Status",
  assignee: "Assignee",
  date: "Date",
  number: "Value",
  location: "Location",
};
export default function DatabaseView({
  node,
  editor,
  getPos,
  updateAttributes,
}: NodeViewProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [sort, setSort] = useState<string | null>("default");
  const [selected, setSelected] = useState<string | null>(null);
  const [trash, setTrash] = useState(false);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [newTitle, setNewTitle] = useState("");
  const editable = editor.isEditable;
  const properties = useDatabaseProperties({ node, editor, getPos });
  const allRows: PersonalRow[] = [];
  node.forEach((child) => { if (child.type.name === "personalDatabaseRow") allRows.push(personalRowValues(child.attrs)); });
  const rows = allRows.filter(
    (row) =>
      !row.deleted &&
      (!status || row.status === status) &&
      [
        row.title,
        row.assignee,
        row.location,
        row.date,
        t(statusLabels[row.status]),
      ]
        .join(" ")
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  if (sort === "name") rows.sort((a, b) => a.title.localeCompare(b.title));
  if (sort === "date") rows.sort((a, b) => a.date.localeCompare(b.date));
  if (sort === "value") rows.sort((a, b) => b.number - a.number);
  const current = allRows.find((row) => row.id === selected);
  const deleted = allRows.filter((row) => row.deleted);
  const view = PERSONAL_DATABASE_VIEWS.includes(node.attrs.view)
    ? node.attrs.view
    : "table";
  const rowPosition = (id: string) => {
    const pos = getPos();
    if (typeof pos !== "number") return null;
    const live = editor.state.doc.nodeAt(pos);
    if (live?.type.name !== "personalDatabase") return null;
    let found: number | null = null;
    live.forEach((child, offset) => {
      if (child.attrs.id === id) found = pos + 1 + offset;
    });
    return found;
  };
  const change = (
    id: string,
    field: keyof PersonalRow,
    value: string | number | boolean,
  ) => {
    if (!editor.isEditable) return;
    const pos = rowPosition(id);
    if (pos === null) return;
    const live = editor.state.doc.nodeAt(pos);
    if (!live || live.attrs[field] === value) return;
    editor.commands.command(({ tr }) => {
      tr.setNodeMarkup(pos, undefined, { ...live.attrs, [field]: value });
      return true;
    });
  };
  const add = (title = "", rowStatus = "todo", date = "") => {
    if (!editor.isEditable) return;
    const pos = getPos();
    const live = typeof pos === "number" && editor.state.doc.nodeAt(pos);
    if (!live || live.type.name !== "personalDatabase") return;
    const id = crypto.randomUUID();
    editor.commands.insertContentAt(pos + live.nodeSize - 1, {
      type: "personalDatabaseRow",
      attrs: { id, title, status: rowStatus, date },
    });
    setNewTitle("");
    setSelected(id);
  };
  const customCsv = () => {
    const quote = (value: unknown) => { let text = String(value ?? ""); if (/^[\s]*[=+\-@]/.test(text)) text = "'" + text; return '"' + text.replace(/"/g, '""') + '"'; };
    return [ [...fields, ...properties.definitions.map(d => d.name)].map(quote).join(","),
      ...rows.map(row => [...fields.map(field => row[field]), ...properties.definitions.map(def => { try { return properties.value(row.id, def); } catch { return "#ERROR"; } })].map(quote).join(",")) ].join("\r\n");
  };
  const exportCsv = () => {
    const url = URL.createObjectURL(
      new Blob(["\ufeff" + (properties.definitions.length ? customCsv() : personalRowsToCsv(rows))], {
        type: "text/csv;charset=utf-8",
      }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "nopetion-database.csv";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const cell = (row: PersonalRow, field: (typeof fields)[number]) =>
    field === "status" ? (
      <select
        aria-label={t("Status")}
        value={row.status}
        disabled={!editable}
        onChange={(e) => change(row.id, field, e.target.value)}
      >
        {Object.entries(statusLabels).map(([value, label]) => (
          <option key={value} value={value}>
            {t(label)}
          </option>
        ))}
      </select>
    ) : field === "number" ? (
      <input
        key={row.number}
        type="number"
        aria-label={t(fieldLabels[field])}
        defaultValue={row.number}
        readOnly={!editable}
        onBlur={(e) => {
          const value = Number(e.target.value);
          if (Number.isFinite(value)) change(row.id, field, value);
        }}
      />
    ) : (
      <input
        aria-label={t(fieldLabels[field])}
        type={field === "date" ? "date" : "text"}
        value={row[field]}
        readOnly={!editable}
        maxLength={500}
        placeholder={field === "title" ? t("Untitled") : undefined}
        onChange={(e) => change(row.id, field, e.target.value)}
      />
    );
  const card = (row: PersonalRow) => (
    <button
      className={classes.card}
      key={row.id}
      onClick={() => setSelected(row.id)}
    >
      <strong>{row.title || t("Untitled")}</strong>
      <span className={classes.status} data-status={row.status}>
        {t(statusLabels[row.status])}
      </span>
      {row.assignee && <span>{row.assignee}</span>}
      {row.date && <small>{row.date}</small>}
    </button>
  );
  const stats = useMemo(
    () =>
      Object.entries(statusLabels).map(([key, label]) => ({
        key,
        label: t(label),
        count: rows.filter((row) => row.status === key).length,
        value: rows
          .filter((row) => row.status === key)
          .reduce((sum, row) => sum + row.number, 0),
      })),
    [rows, t],
  );
  const chart = (kind: string) => {
    const max = Math.max(1, ...stats.map((item) => item.count));
    const total = stats.reduce((sum, item) => sum + item.count, 0);
    const colors = ["#c7c7c2", "#96badd", "#94b6a3"];
    if (kind === "number")
      return (
        <div className={classes.number}>
          <strong>{rows.reduce((sum, row) => sum + row.number, 0)}</strong>
          <span>
            {t("Sum")} · {rows.length} {t("records")}
          </span>
        </div>
      );
    if (kind === "donut") {
      let start = 0;
      const gradient = stats
        .map((item, i) => {
          const end = start + (total ? (item.count / total) * 100 : 0);
          const part = `${colors[i]} ${start}% ${end}%`;
          start = end;
          return part;
        })
        .join(",");
      return (
        <div className={classes.donutWrap}>
          <div
            className={classes.donut}
            style={{
              background: total ? `conic-gradient(${gradient})` : "#e9e9e7",
            }}
          >
            <span>{total}</span>
          </div>
          <div>
            {stats.map((item, i) => (
              <div key={item.key}>
                <i style={{ background: colors[i] }} />
                {item.label}: {item.count}
              </div>
            ))}
          </div>
        </div>
      );
    }
    if (kind === "line")
      return (
        <div>
          <svg
            viewBox="0 0 400 150"
            className={classes.lineChart}
            role="img"
            aria-label={t("Record count by status")}
          >
            <path d="M30 120 H370 M30 20 V120" stroke="#ddd" fill="none" />
            <polyline
              points={stats
                .map(
                  (item, i) =>
                    `${40 + i * 155},${115 - (item.count / max) * 90}`,
                )
                .join(" ")}
              fill="none"
              stroke="#2383e2"
              strokeWidth="3"
            />
            {stats.map((item, i) => (
              <g key={item.key}>
                <circle
                  cx={40 + i * 155}
                  cy={115 - (item.count / max) * 90}
                  r="4"
                  fill="#2383e2"
                />
                <text
                  x={40 + i * 155}
                  y="140"
                  textAnchor="middle"
                  fontSize="12"
                  fill="currentColor"
                >
                  {item.label} ({item.count})
                </text>
              </g>
            ))}
          </svg>
        </div>
      );
    return (
      <div
        className={
          kind === "horizontal-bar" ? classes.horizontalBars : classes.bars
        }
      >
        {stats.map((item, i) => (
          <div key={item.key}>
            <span>{item.label}</span>
            <div
              style={{
                background: colors[i],
                [kind === "horizontal-bar" ? "width" : "height"]:
                  `${Math.max(3, (item.count / max) * 100)}%`,
              }}
            />
            <small>{item.count}</small>
          </div>
        ))}
      </div>
    );
  };
  const monthStart = new Date(month + "-01T12:00:00");
  const days = new Date(
    monthStart.getFullYear(),
    monthStart.getMonth() + 1,
    0,
  ).getDate();
  const calendar = (
    <>
      <input
        className={classes.month}
        type="month"
        aria-label={t("Month")}
        value={month}
        onChange={(e) => {
          if (e.target.value) setMonth(e.target.value);
        }}
      />
      <div className={classes.calendar}>
        {Array.from({ length: monthStart.getDay() }, (_, i) => (
          <div key={`pad${i}`} />
        ))}
        {Array.from({ length: days }, (_, i) => {
          const date = `${month}-${String(i + 1).padStart(2, "0")}`;
          return (
            <div key={date}>
              <Group justify="space-between" gap={0}>
                <small>{i + 1}</small>
                {editable && (
                  <ActionIcon
                    size="xs"
                    variant="subtle"
                    aria-label={`${t("New record")} ${date}`}
                    onClick={() => add("", "todo", date)}
                  >
                    <IconPlus size={12} />
                  </ActionIcon>
                )}
              </Group>
              {rows
                .filter((r) => r.date === date)
                .map((r) => (
                  <button key={r.id} onClick={() => setSelected(r.id)}>
                    {r.title || t("Untitled")}
                  </button>
                ))}
            </div>
          );
        })}
      </div>
      {!!rows.filter((r) => !r.date).length && (
        <p className={classes.note}>
          {t("No date")}: {rows.filter((r) => !r.date).length}
        </p>
      )}
    </>
  );
  return (
    <NodeViewWrapper
      className={classes.database}
      data-personal-database
      data-type="personalDatabase"
      data-view={view}
      contentEditable={false}
    >
      <div className={classes.titleRow}>
        <input
          aria-label={t("Database title")}
          value={node.attrs.title}
          readOnly={!editable}
          maxLength={200}
          onChange={(e) => updateAttributes({ title: e.target.value })}
        />
        <Select
          aria-label={t("Database view")}
          value={view}
          onChange={(value) => {
            if (value && editable) updateAttributes({ view: value });
          }}
          disabled={!editable}
          data={PERSONAL_DATABASE_VIEWS.map((value) => ({
            value,
            label: t(viewLabels[value]),
          }))}
          variant="unstyled"
          size="xs"
          w={180}
        />
      </div>
      {properties.configuration}
      <div className={classes.toolbar}>
        <TextInput
          leftSection={<IconSearch size={14} />}
          aria-label={t("Search records")}
          placeholder={t("Search")}
          value={query}
          onChange={(e) => setQuery(e.currentTarget.value)}
          size="xs"
          variant="unstyled"
        />
        <Select
          aria-label={t("Filter by status")}
          placeholder={t("Filter")}
          value={status}
          onChange={(value) => setStatus(value == null ? null : String(value))}
          clearable
          size="xs"
          variant="unstyled"
          w={125}
          data={Object.entries(statusLabels).map(([value, label]) => ({
            value,
            label: t(label),
          }))}
        />
        <Select
          aria-label={t("Sort records")}
          value={sort}
          onChange={(value) => setSort(value == null ? null : String(value))}
          data={[
            { value: "default", label: t("Default order") },
            { value: "name", label: t("Name") },
            { value: "date", label: t("Date") },
            { value: "value", label: t("Value") },
          ]}
          variant="unstyled"
          size="xs"
          w={110}
        />
        <ActionIcon
          variant="subtle"
          color="gray"
          aria-label={t("Export CSV")}
          onClick={exportCsv}
        >
          <IconDownload size={16} />
        </ActionIcon>
        <ActionIcon
          variant="subtle"
          color="gray"
          aria-label={t("Deleted records")}
          onClick={() => setTrash(true)}
        >
          <IconTrash size={16} />
        </ActionIcon>
        {editable && <Button size="xs" variant="subtle" onClick={properties.add}>＋ {t("Add property")}</Button>}
        {editable && (
          <Button
            size="xs"
            leftSection={<IconPlus size={14} />}
            onClick={() => add()}
          >
            {t("New")}
          </Button>
        )}
      </div>
      {view === "table" && (
        <div className={classes.tableScroll}>
          <table>
            <thead>
              <tr>
                {fields.map((field) => (
                  <th key={field}>{t(fieldLabels[field])}</th>
                ))}
                {properties.definitions.map(def => <th key={def.id} data-db-property><button disabled={!editable} onClick={() => properties.edit(def)}>{def.name}</button></th>)}
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} data-record-id={row.id}>
                  {fields.map((field) => (
                    <td key={field}>{cell(row, field)}</td>
                  ))}
                  {properties.definitions.map(def => <td key={def.id} data-db-property>{properties.renderCell(row.id, def)}</td>)}
                  <td>
                    <ActionIcon
                      variant="subtle"
                      color="gray"
                      size="xs"
                      aria-label={t("Open record")}
                      onClick={() => setSelected(row.id)}
                    >
                      ↗
                    </ActionIcon>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {view === "board" && (
        <div className={classes.board}>
          {Object.entries(statusLabels).map(([key, label]) => (
            <section
              key={key}
              onDragOver={(e) => {
                if (editable) e.preventDefault();
              }}
              onDrop={(e) => {
                e.preventDefault();
                const id = e.dataTransfer.getData(
                  "application/x-nopetion-record",
                );
                if (allRows.some((row) => row.id === id && !row.deleted))
                  change(id, "status", key);
              }}
            >
              <h4>
                <span className={classes.status} data-status={key}>
                  {t(label)}
                </span>{" "}
                <small>{rows.filter((row) => row.status === key).length}</small>
              </h4>
              {rows
                .filter((row) => row.status === key)
                .map((row) => (
                  <div
                    key={row.id}
                    draggable={editable}
                    onDragStart={(e) =>
                      e.dataTransfer.setData(
                        "application/x-nopetion-record",
                        row.id,
                      )
                    }
                  >
                    {card(row)}
                  </div>
                ))}
              {editable && (
                <button className={classes.add} onClick={() => add("", key)}>
                  ＋ {t("New record")}
                </button>
              )}
            </section>
          ))}
        </div>
      )}
      {view === "gallery" && (
        <div className={classes.gallery}>
          {rows.map((row) => (
            <div key={row.id}>
              <div className={classes.galleryPreview}>📄</div>
              {card(row)}
            </div>
          ))}
        </div>
      )}
      {(view === "list" || view === "feed") && (
        <div className={view === "feed" ? classes.feed : classes.list}>
          {rows.map(card)}
        </div>
      )}
      {view === "calendar" && calendar}
      {view === "timeline" && (
        <div className={classes.timeline}>
          {[...rows]
            .sort((a, b) => a.date.localeCompare(b.date))
            .map((row) => (
              <div key={row.id}>
                <time>{row.date || t("No date")}</time>
                {card(row)}
              </div>
            ))}
        </div>
      )}
      {view === "map" && (
        <>
          <p className={classes.note}>
            {t(
              "Location notes. Open a location in Google Maps to see its map.",
            )}
          </p>
          <div className={classes.gallery}>
            {rows.map((row) => (
              <div key={row.id}>
                {card(row)}
                <input
                  aria-label={t("Location")}
                  placeholder={t("Address or place")}
                  value={row.location}
                  readOnly={!editable}
                  onChange={(e) => change(row.id, "location", e.target.value)}
                />
                {row.location && (
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(row.location)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {t("Open map")} ↗
                  </a>
                )}
              </div>
            ))}
          </div>
        </>
      )}
      {["bar", "horizontal-bar", "line", "donut", "number"].includes(view) &&
        chart(view)}
      {view === "dashboard" && (
        <>
          <div className={classes.dashboard}>
            {stats.map((item) => (
              <div key={item.key}>
                <small>{item.label}</small>
                <strong>{item.count}</strong>
              </div>
            ))}
          </div>
          {chart("bar")}
          {chart("number")}
        </>
      )}
      {view === "form" && (
        <form
          className={classes.form}
          onSubmit={(e) => {
            e.preventDefault();
            if (newTitle.trim()) add(newTitle.trim());
          }}
        >
          <label>
            {t("Name")}
            <input
              aria-label={t("New record name")}
              value={newTitle}
              disabled={!editable}
              required
              maxLength={500}
              onChange={(e) => setNewTitle(e.target.value)}
            />
          </label>
          <Button
            type="submit"
            disabled={!editable || !newTitle.trim()}
            size="sm"
          >
            {t("Add record")}
          </Button>
          <p className={classes.note}>
            {t("Only signed-in editors can submit this form.")}
          </p>
        </form>
      )}
      {!rows.length && view !== "form" && (
        <div className={classes.empty}>{t("No records")}</div>
      )}
      {editable && view !== "form" && (
        <button className={classes.add} onClick={() => add()}>
          ＋ {t("New record")}
        </button>
      )}
      <div hidden>
        <NodeViewContent />
      </div>
      <Modal
        opened={!!current}
        onClose={() => setSelected(null)}
        title={t("Record details")}
        centered
      >
        <Stack gap="sm">
          {current &&
            fields.map((field) => (
              <label className={classes.detailField} key={field}>
                {t(fieldLabels[field])}
                {cell(current, field)}
              </label>
            ))}
          {current && properties.definitions.map(def => <label className={classes.detailField} key={def.id}>{def.name}{properties.renderCell(current.id, def)}</label>)}
          {current && editable && (
            <Button
              color="red"
              variant="subtle"
              leftSection={<IconTrash size={16} />}
              onClick={() => {
                change(current.id, "deleted", true);
                setSelected(null);
              }}
            >
              {t("Move record to trash")}
            </Button>
          )}
        </Stack>
      </Modal>
      <Modal
        opened={trash}
        onClose={() => setTrash(false)}
        title={t("Deleted records")}
        centered
      >
        <Stack>
          {deleted.length ? (
            deleted.map((row) => (
              <Group key={row.id} justify="space-between">
                <span>{row.title || t("Untitled")}</span>
                <Button
                  size="xs"
                  variant="light"
                  disabled={!editable}
                  onClick={() => change(row.id, "deleted", false)}
                >
                  {t("Restore")}
                </Button>
              </Group>
            ))
          ) : (
            <p>{t("No deleted records")}</p>
          )}
        </Stack>
      </Modal>
    </NodeViewWrapper>
  );
}
