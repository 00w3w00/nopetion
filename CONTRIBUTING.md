# Contributing

Use Node.js 24 and pnpm 11.28.2. Keep the React/Mantine client, NestJS server and shared editor in this pnpm/Nx monorepo. Install with `pnpm install --frozen-lockfile` and follow [the development instructions](README.md#development).

Preserve persistence, autosave, history, trash restoration, explicit workspace ownership and document/attachment authorization. Verify Korean input, keyboard navigation and narrow screens when changing the editor or navigation. Use isolated accounts and storage for destructive tests.

Run `pnpm build`, `pnpm lint`, `pnpm test`, `pnpm test:personal` and `node --test tests/*.test.mjs` as appropriate. Record unexecuted checks honestly. Dependency updates must retain the root lockfile and explain why versions changed.

The core is AGPL-3.0. Keep original copyright, permission and disclaimer notices. Preserve the separate license documents at Enterprise boundaries; do not restore or reuse removed commercial implementations. Add full upstream notices and provenance for adapted third-party source under `notices/vendored`. See [source releases](docs/source-release.md) before distributing an archive or container.
