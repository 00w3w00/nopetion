# Install Nopetion on your server

[한국어](server-install.ko-KR.md)

Nopetion uses the existing pnpm/Nx monorepo and Docker Compose. Source archives contain the application and build material, never your real `.env`, accounts, documents, attachments, AI credentials, backups or original Git history.

## Start a fresh installation

Install Docker Engine/Desktop and Docker Compose. Use Node.js 24 to create configuration:

```sh
node scripts/init-env.mjs
```

The initializer refuses to overwrite an existing `.env`. If Node.js is unavailable on a Linux/macOS host:

```sh
docker run --rm --user "$(id -u):$(id -g)" \
  -v "$PWD:/workspace" -w /workspace \
  node:24-slim node scripts/init-env.mjs
```

Set `APP_URL` in the generated `.env` to your browser address **before building**. The app secret and PostgreSQL password are infrastructure secrets, separate from the password you choose at first login.

```dotenv
APP_URL=http://localhost:3000
```

```sh
docker compose up --build -d
docker compose ps
```

The first build downloads dependencies, the local transcription engine and its model. Allow network access and sufficient disk space. Build on the target CPU architecture.

Compose binds the application to `127.0.0.1:3000`. PostgreSQL and Redis do not publish host ports. For initial access from another computer:

```sh
ssh -L 3000:127.0.0.1:3000 user@your-server
```

Open `http://localhost:3000`. Use a private HTTPS proxy for normal remote access and set `APP_URL` to that HTTPS address. Keep existing services and proxy routes intact.

On an empty installation, enter the same nonempty password in **Password** and **Confirm password**. This creates the single personal owner and default workspace. Subsequent logins use only the password. Keep it safe: email password recovery is unavailable.

## Configure application features

- Attachments stay in local persistent storage. S3/Azure and mail delivery are unavailable.
- Configure Draw.io, optional Gotenberg PDF/A processing and iframe origins in **Settings → Server features**, with owner-only access.
- An empty Gotenberg address uses the built-in PDF exporter.
- Connect AI and external services through their settings. Credentials from other tools are not imported, and the app never switches to a paid provider automatically.
- [Connect AI to a remote/headless server](ai-connection.md). Initial sign-in happens on your own computer through a loopback-only bridge; normal use remains on the private HTTPS address.

## Deploy under a path

For an address such as `https://your-server.example/nopetion`, set that full `APP_URL` **before** building. Changing its path requires rebuilding the app, while keeping the same data volumes.

Your proxy must strip `/nopetion` for both HTTP and WebSockets. External `/nopetion/api/health` maps to internal `/api/health`. Tailscale Serve's `--set-path=/nopetion` uses this arrangement. Preserve any existing root or other-port handlers; do not enable public Funnel access as part of installation.

Login, attachments, translations, realtime editing, cookies and PWA scope follow the configured path. For GitHub and other external connectors, register the full callback address shown in settings, including the mount path. AI uses its separate HTTP numeric-loopback callback contract; see the AI connection guide.

## Back up before updating

The database, Redis queue, attachments, AI store and external connector store use five persistent volumes. Use the [encrypted backup and restoration guide](backup-restore.md), retain a separate key copy and verify restoration to fresh targets. New snapshots also preserve exact application/PostgreSQL/Redis images so a replacement host can import a cold cache.

The backup scheduler records its last verified snapshot and preserves unrelated cron jobs. It does not prune backups. A real backup briefly stops only the selected app and Redis, then restarts the same containers; choose an appropriate maintenance time.

For an update, keep the same project and `.env`, preserve all volumes, build the verified source, and replace only the application service:

```sh
docker compose build nopetion
docker compose up -d --no-deps nopetion
```

Verify `/api/health`, login, a saved test document and attachments. Keep the previous image/source for rollback. Do not delete volumes or rerun first setup to test an update. For changes that include database migrations, review migration compatibility before attempting a rollback.

## Source transfer and public releases

Verify the `.sha256` sidecar and extract a source archive into a new directory. A private source transfer is not a user-data migration.

```sh
sha256sum -c nopetion-server.tar.gz.sha256
tar -xzf nopetion-server.tar.gz
cd nopetion
```

On macOS use `shasum -a 256 -c` instead. To create a new private transfer archive outside the checkout:

```sh
node scripts/package-server.mjs --out /absolute/path/nopetion-server.tar.gz
```

For public source archives and fresh Git history, follow [source releases](source-release.md). Never push the original checkout's commercial history. Public image distribution has separate license and corresponding-source requirements.

Development uses Node.js 24 and pnpm 11.28.2. The optional `docker-compose.dev.yml` exposes development database ports and should remain separate from deployment Compose.
