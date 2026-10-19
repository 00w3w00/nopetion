# License and attribution notices

Nopetion is a modified Docmost 0.96.0 fork. The core is subject to the root AGPL-3.0 license. See `NOPETION-MODIFICATIONS.md`, `docs/upstream-readme.md` and `docs/upstream-source.json` for attribution and changes.

- `vendored/` contains full license texts, original copyright notices and provenance for third-party source adapted into the CE tree.
- `third-party/` contains supplemental notices collected from pinned package releases or release commits. Its manifest distinguishes package-level notices from nested component notices and records unresolved package notice gaps. It is not a blanket binary distribution approval.
- `local-transcription/` retains the model license; Docker builds also preserve the Whisper engine license.
- The bundled Pretendard 1.3.9 web font retains its original SIL OFL 1.1 notice in `apps/client/public/fonts/PRETENDARD-LICENSE.txt`; provenance is in `apps/client/src/assets/fonts/README.md`.
- PDF font licenses stay with the font files under `apps/server/src/integrations/pdf/fonts/`.
- The original `apps/client/src/ee/LICENSE`, `packages/ee/LICENSE` and `packages/base-formula/LICENSE` remain separate terms. Their commercial implementations are excluded.

Follow `docs/source-release.md` before distributing source or prebuilt images. Original copyright and permission notices are not removed by application rebranding.
