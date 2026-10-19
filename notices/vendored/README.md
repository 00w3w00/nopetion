# Vendored source notices

These license texts and copyright notices accompany source adapted in this repository. Existing attribution comments remain in their original files. The manifest records immutable license reference revisions and local paths; it does not assert that adapted implementations match those revisions.

The recreate-transform/recreate-steps root licenses are Apache-2.0. Their inherited MIT shorthand was corrected in this fork. Apache terms also cover the attributed Atlassian table helpers and Google Material icons.

| Upstream | License | Local paths |
| --- | --- | --- |
| [curvenote/prosemirror-docx](https://raw.githubusercontent.com/curvenote/prosemirror-docx/c5a9610b6a10e7e4b5fe1d979a9f78cdb7f5b720/LICENSE) | [MIT](curvenote_prosemirror-docx-LICENSE) | `packages/editor-ext/src/lib/prosemirror-docx` |
| [sueddeutsche/prosemirror-recreate-transform](https://raw.githubusercontent.com/sueddeutsche/prosemirror-recreate-transform/fdfe906cea10db31e1572b368002784a66c4699d/LICENSE) | [Apache-2.0](sueddeutsche_prosemirror-recreate-transform-LICENSE) | `packages/editor-ext/src/lib/recreate-transform` |
| [buttondown/tiptap-footnotes](https://raw.githubusercontent.com/buttondown/tiptap-footnotes/abf2b7823d76c6b885ee503040b504cb9a6ab691/LICENSE) | [MIT](buttondown_tiptap-footnotes-LICENSE) | `packages/editor-ext/src/lib/footnotes` |
| [nhedger/nestjs-encryption](https://raw.githubusercontent.com/nhedger/nestjs-encryption/048fa1d44c8684770bb22a93eed0a021b03acac2/LICENSE.md) | [MIT](nhedger_nestjs-encryption-LICENSE) | `apps/server/src/integrations/encryption` |
| [charlie-hadden/kysely-paginate](https://raw.githubusercontent.com/charlie-hadden/kysely-paginate/ed37a87ad9c940596fc44e6b590d6d9ba6289b8d/LICENSE) | [MIT](charlie-hadden_kysely-paginate-LICENSE) | `apps/server/src/database/pagination` |
| [mantinedev/mantine](https://raw.githubusercontent.com/mantinedev/mantine/e47e45af06427b3b2497100c2b849935c23af30d/LICENSE) | [MIT](mantinedev_mantine-LICENSE) | `apps/client/src/components/common/copy-button.tsx`, `apps/client/src/hooks/use-clipboard.ts`, `apps/client/src/hooks/use-idle.ts` |
| [aguingand/tiptap-markdown](https://raw.githubusercontent.com/aguingand/tiptap-markdown/96f5b0f6e4d318edde507a6ca18269c4e6340676/LICENSE) | [MIT](aguingand_tiptap-markdown-LICENSE) | `apps/client/src/features/editor/extensions/markdown-clipboard.ts` |
| [ueberdosis/hocuspocus](https://raw.githubusercontent.com/ueberdosis/hocuspocus/9def0469c9cd6e9c09d3f51bd4ee282637929c9a/LICENSE.md) | [MIT](ueberdosis_hocuspocus-LICENSE) | `apps/server/src/collaboration/extensions/redis-sync` |
| [google/material-design-icons](https://raw.githubusercontent.com/google/material-design-icons/49d4db35df873165d6bd6ba09b063c7dafbac2f4/LICENSE) | [Apache-2.0](google_material-design-icons-LICENSE) | `packages/editor-ext/src/lib/heading/heading.ts` |
| [ProseMirror/prosemirror-commands](https://raw.githubusercontent.com/ProseMirror/prosemirror-commands/52a84a842774fadec3b167bcdbd56085ec6c85df/LICENSE) | [MIT](ProseMirror_prosemirror-commands-LICENSE) | `apps/client/src/features/editor/extensions/autojoiner.ts` |
| [gitlab.com/mpapp-public/prosemirror-recreate-steps](https://gitlab.com/mpapp-public/prosemirror-recreate-steps/-/raw/6219070b8e2435c9c3111660b7f2c558feb22f22/LICENSE) | [Apache-2.0](mpapp-prosemirror-recreate-steps-LICENSE) | `packages/editor-ext/src/lib/recreate-transform` |
| [ueberdosis/tiptap](https://raw.githubusercontent.com/ueberdosis/tiptap/91c51be53c4655ef07e29ec489471524debfa0ca/LICENSE.md) | [MIT](ueberdosis_tiptap-LICENSE) | `packages/editor-ext/src/lib/resizable-nodeview.ts`, `packages/editor-ext/src/lib/trailing-node.ts`, `packages/editor-ext/src/lib/embed.ts`, `packages/editor-ext/src/lib/custom-code-block/custom-code-block.ts`, `packages/editor-ext/src/lib/callout/callout.ts`, `packages/editor-ext/src/lib/attachment/attachment.ts`, `packages/editor-ext/src/lib/math`, `packages/editor-ext/src/lib/subpages/subpages.ts`, `apps/client/src/features/editor/extensions/extensions.ts` |
| [remirror/remirror](https://raw.githubusercontent.com/remirror/remirror/e0f1bec4a1e8073ce8f5500d62193e52321155b9/LICENSE) | [MIT](remirror_remirror-LICENSE) | `packages/editor-ext/src/lib/trailing-node.ts` |
| [typestack/class-validator](https://raw.githubusercontent.com/typestack/class-validator/2e1a5c27dbd65b80e27fe96b49bd6e6641fa3603/LICENSE) | [MIT](typestack_class-validator-LICENSE) | `apps/server/src/common/validators/is-iso6391.ts` |
| [NiclasDev63/tiptap-extension-auto-joiner](https://raw.githubusercontent.com/NiclasDev63/tiptap-extension-auto-joiner/0de5dcba6e95757e7876db63b50d0693c5513f62/LICENSE.md) | [MIT](NiclasDev63_tiptap-extension-auto-joiner-LICENSE) | `apps/client/src/features/editor/extensions/autojoiner.ts` |
| [bitbucket.org/atlassian/atlassian-frontend-mirror](https://bitbucket.org/atlassian/atlassian-frontend-mirror/raw/5f91cb871e8248bc3bae5ddc30bb9fd9200fadbb/editor/editor-tables/LICENSE) | [Apache-2.0](atlassian-editor-tables-LICENSE) | `packages/editor-ext/src/lib/table/utils/get-selection-range-in-row.ts`, `packages/editor-ext/src/lib/table/utils/get-selection-range-in-column.ts` |

Full permission notices already embedded in `html-escaper.ts`, `search-and-replace.ts` and the UUID-v7 migration are preserved. PDF fonts retain their OFL texts next to their binaries.

The build-only [braces patch](../../patches/braces@3.0.3.patch) retains the [original MIT notice](braces-LICENSE). Its bounded-recursion regression tests and remaining scanner advisory are described in SECURITY.md.

The recreate-transform/recreate-steps Apache components retain their original [Atypon Systems NOTICE](recreate-steps-NOTICE). Older trailing-node adaptations also retain the [Tiptap v1 copyright and MIT notice](tiptap-v1-LICENSE). Adapted ProseMirror website examples retain the [website MIT notice](ProseMirror-website-LICENSE).
