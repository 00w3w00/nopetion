<div align="center">
  <img src="../../apps/client/public/icons/nopetion.svg" width="72" height="72" alt="Nopetion" />
  <h1>Nopetion</h1>
  <p><strong>Notion? Nope. Your docs, your rules.</strong></p>
  <p>Your own document workspace, on your own server.</p>
  <p>
    <img alt="Node.js 24" src="https://img.shields.io/badge/Node.js-24-43853d?style=flat-square" />
    <img alt="pnpm 11.28.2" src="https://img.shields.io/badge/pnpm-11.28.2-f69220?style=flat-square" />
    <img alt="Local storage" src="https://img.shields.io/badge/storage-local-54718c?style=flat-square" />
  </p>
</div>

[한국어](ko-KR.md) · [English](en-US.md) · [日本語](ja-JP.md) · [简体中文](zh-CN.md) · [Deutsch](de-DE.md) · [Español](es-ES.md) · [Français](fr-FR.md) · [Italiano](it-IT.md) · [Nederlands](nl-NL.md) · [Português](pt-BR.md) · [Русский](ru-RU.md) · [Українська](uk-UA.md)

---

A personal workspace built on Docmost, with a block editor, nested pages, document AI and local attachments.

## What you can do

- Write with blocks, tables, code and community database views.
- Organize nested pages and independent personal workspaces; restore trash and page history.
- Choose from the full emoji picker and 96 suggested page icons.
- Export the current page with selected descendants as one PDF, with Korean fonts.
- Install the PWA and opt in to offline editing for selected pages; reconnect to synchronize.
- Generate classification tags and lists without moving your documents.
- Connect document AI separately and review job status in the document AI panel.

## Get started

Use Docker Compose and Node.js 24 (or the container-based setup in the installation guide). Generate fresh infrastructure secrets, set APP_URL in .env to the address you actually use, then start the app.

```sh
node scripts/init-env.mjs
# Set APP_URL in .env
docker compose up --build -d
```

Open the app and enter the same password in Password and Confirm password. This creates the first personal owner. Later logins use only the password. Empty passwords are rejected; one character is allowed, with no separate character-count cap.

[Server installation guide](../server-install.md)

## Settings, inside the app

Settings → Server features manages Draw.io, optional Gotenberg PDF/A processing, and the sites allowed to frame Nopetion. Saving settings requires the personal owner session. Local attachments are the supported storage mode. Email delivery and email password recovery are removed.

## Moving to another server

The private source bundle includes code and license notices. Real .env files, accounts, documents, attachments, backups and Git history are excluded. Generate new secrets on the destination.

[Installation & transfer](../server-install.md) · [Backup & restore](../backup-restore.md)

## Development

Node.js **24** · pnpm **11.28.2** · React/Mantine · NestJS · pnpm/Nx

```sh
corepack pnpm@11.28.2 install --frozen-lockfile
pnpm build
pnpm lint
pnpm test
pnpm test:personal
```

## License and project status

Derived from Docmost 0.96.0. The core uses AGPL-3.0; original copyright and third-party notices remain. Enterprise paths have separate terms, and the removed commercial implementations are not enabled. Do not treat the whole historical tree as AGPL. Public distribution checks are still open; this package is prepared for private server testing.

[Docmost](https://github.com/docmost/docmost) · [AGPL-3.0](../../LICENSE) · [Original README](../upstream-readme.md) · [Source record](../upstream-source.json) · [Notices](../../notices)
