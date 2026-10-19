# Consistent, encrypted Nopetion backups

These tools back up the database, attachments, dedicated AI store, connector store, Redis queues, and effective configuration as one snapshot. They use Node 24 built-ins and the locally cached application/PostgreSQL images; no package or lockfile changes are required. Run them from this repository. They neither prune backups nor delete volumes.

`inspect` and commands without `--execute` are read-only. A real backup temporarily stops **the selected source app and Redis**, then restarts those same containers. A restore creates **five new volumes** and private configuration files; it does not start Nopetion or expose ports. Creating these tools is separate from authorization to stop or back up an operating instance. Do not execute the maintenance examples against an operating instance until that maintenance window is authorized.

## What is preserved

| Component | Capture | Purpose |
| --- | --- | --- |
| PostgreSQL | `pg_dump` custom format, gzip level 3, no ownership/ACL restore dependency | Committed documents, history, users, workspace settings, AI jobs and notification outbox |
| Attachments | Compressed archive of the actual storage volume | Authorized file contents |
| Dedicated AI store | Compressed archive of the entire volume | Independent AI encryption key, host identity and encrypted settings |
| Connector store | Compressed archive of the entire volume | Encrypted external connection/token settings |
| Redis | Compressed archive of its stopped data volume | Complete AOF files/manifests and persisted queue state |
| Exact runtime images | Tag-free Docker archive of the three deployed image IDs | Recovery on an empty image cache |
| Configuration | Encrypted source `.env`, labeled Compose files and each container's complete effective environment | `APP_SECRET`, database password, provider/OAuth configuration and values overridden at deployment |

All components are encrypted independently with AES-256-GCM. Object references use keyed content hashes. A separate HMAC authenticates the manifest and binds all components and the exact source container/volume identities together. SHA-256 checksums cover encrypted and decrypted bytes. Directories must have private permissions, files use `0600`, and symlinks are refused for the key/store paths. Credentials are passed to temporary containers through process environment names, not command arguments. Docker diagnostics and configuration values are not printed.

Keep the **32-byte backup encryption key outside both the source project and backup store**. Store an independent protected copy separately. Losing this key makes recovery impossible. The AI key and `APP_SECRET` are inside the encrypted snapshot; they do not replace the backup key. Anyone who has both backup key and backup files can read the entire workspace and its connection secrets. The effective environment exported during restore is plaintext inside a private directory.

New snapshots include an encrypted, tag-free archive of the exact application, PostgreSQL and Redis image IDs. Unchanged image sets reuse the same object. Verification checks archive paths, configuration hashes and OCI identity bindings before import. Legacy snapshots without this optional seventh component still require exact cached images. Restore never pulls an image or replaces an image tag. This version targets the repository's local Compose layout, PostgreSQL 18 and Redis with AOF enabled. It refuses remote databases, remote or authenticated Redis, bind/NFS storage, extra source services/mounts, mismatched project ownership, and other running containers that can write the selected volumes.

## Consistency and downtime

Select the Compose project explicitly. The script resolves each **actual mounted volume** from Docker metadata and checks both its project and logical-volume labels. It does not concatenate a guessed project prefix. There must be exactly one `nopetion`, `db` and `redis` service, and the five logical volumes must be `docmost`, `personal_ai`, `personal_connectors`, `db_data` and `redis_data`. The containers' labeled project directory must match `--project-dir` exactly.

Exact runtime images are captured and verified before maintenance. The app's attachment/AI/connector volumes are optimistically archived while it runs. Sorted metadata fingerprints include names, ownership, permissions, size, and nanosecond modification/change times. A capture is reusable only when the before/after inventories agree and the final stopped-app inventory still agrees. Changed volumes are recaptured after quiescence. Unchanged volumes can reuse already encrypted objects across snapshots.

The script then requests a graceful app stop, allowing up to 660 seconds for shutdown hooks and active work. The application's collaboration shutdown hooks close connections and flush pending stores. An OOM, forced kill, or abnormal exit prevents snapshot publication. After the app exits, the script rejects additional database clients and rechecks external volume writers. Redis must have AOF enabled; it is stopped normally before the **entire** Redis data volume is archived. PostgreSQL remains running for its custom dump. All four file inventories and database clients are checked again before publishing. Redis becomes ready before the original app container is restarted, including on a caught failure.

This is an application maintenance barrier, not an atomic storage-system snapshot. Operators must prevent new out-of-band PostgreSQL clients or host/VM-level volume writers during the window. The checks detect observed competing access; they cannot lock an unknown administrator out of Docker or PostgreSQL. These tools require trusted local Docker administration and an unmodified app with functioning graceful shutdown hooks.

The backup covers **database-committed** state. Browser edits that have not reached the server are not included. Graceful shutdown can wait for AI workers; a killed process or an already interrupted generation may later be retried, recovered or marked failed by the app's existing job recovery rules. Capturing PostgreSQL plus Redis and the dedicated AI store preserves recovery inputs, not an exactly-once guarantee for an external provider request or process memory. Stop editing before maintenance and inspect active AI jobs afterward. Restoration does not contact an AI provider.

PostgreSQL documents that its dump is consistent within the database; coordinating external files requires the application barrier above. Redis documents that AOF backups must preserve their manifests and constituent files. See [PostgreSQL pg_dump](https://www.postgresql.org/docs/18/app-pgdump.html) and [Redis persistence](https://redis.io/docs/latest/operate/oss_and_stack/management/persistence/).

## Prepare and inspect

The example paths are outside the source repository. Use a real, nonsymlink path on a filesystem that supports private Unix permissions and atomic rename/hard links.

```sh
umask 077
mkdir -p "$HOME/.config/nopetion-backup"
node scripts/backup.mjs keygen --key-file "$HOME/.config/nopetion-backup/key"
```

Key generation is exclusive: it refuses an existing key. Confirm the exact Compose project name using Docker's project listing, then inspect it. Substitute the actual project name if it differs from `nopetion`.

```sh
docker compose ls
node scripts/backup.mjs inspect --project nopetion --project-dir "$PWD"
node scripts/backup.mjs create --project nopetion --project-dir "$PWD" \
  --store "$HOME/NopetionBackups" --key-file "$HOME/.config/nopetion-backup/key"
```

The second command above is also a dry run: it checks source metadata and prints planned actions without stopping containers or creating a snapshot. It does not prove that the key, helper tools, storage capacity, or an eventual dump will succeed.

For an authorized maintenance window, add both execution flags:

```sh
node scripts/backup.mjs create --project nopetion --project-dir "$PWD" \
  --store "$HOME/NopetionBackups" --key-file "$HOME/.config/nopetion-backup/key" \
  --execute --confirm-project nopetion
```

Capture the reported snapshot ID. Verify it offline without starting a container:

```sh
node scripts/backup.mjs verify --store "$HOME/NopetionBackups" \
  --key-file "$HOME/.config/nopetion-backup/key" --snapshot latest
```

`verify` authenticates the manifest, ciphertext, GCM tags, plaintext checksums and bounded archive paths/types. It is not a substitute for periodically restoring into isolated targets and checking application data. Archives containing links, special files, elevated permissions or unsafe paths are refused rather than extracted.

## Interrupted backups

The private store contains `pending.json` and a process lock while a backup runs. Stop intents are durably recorded **before** stopping a source container. Normal exceptions run recovery automatically. `SIGINT`/`SIGTERM` request an orderly abort at the next operation boundary; a long Docker operation can delay that boundary. Power loss or `SIGKILL` can leave the app/Redis stopped.

Recovery requires the original exact container IDs, image IDs, project and directory. It starts only the app/Redis named in that journal if this operation had recorded a stop. It does not recreate containers or change volume/network configuration.

Run the recovery command without `--execute` first to inspect the stopped-service plan, including when the source services are currently stopped.

```sh
node scripts/backup.mjs recover --project nopetion --project-dir "$PWD" \
  --store "$HOME/NopetionBackups" --execute --confirm-project nopetion --resume
```

To recover and complete a backup, use the original `create` command with `--resume`:

```sh
node scripts/backup.mjs create --project nopetion --project-dir "$PWD" \
  --store "$HOME/NopetionBackups" --key-file "$HOME/.config/nopetion-backup/key" \
  --execute --confirm-project nopetion --resume
```

Resume refuses a live process lock. After recovering the source services it opens a **new consistency window** and takes a new database dump; it never combines a stale dump with newer files. Only revalidated pre-copy objects are reused. Partial object writes are not published. A complete, authenticated snapshot can remain valid even if the process dies before journal cleanup; offline verification determines whether it is usable.

Do not delete the lock/journal to force progress while another process is alive. If Docker is unavailable or a source container was replaced, restore Docker access and resolve that identity change explicitly. The tool deliberately refuses to start a replacement container by a guessed name.

## Inspect and restore into new targets

Inspect is offline and prints no environment values:

```sh
node scripts/restore.mjs inspect --store "$HOME/NopetionBackups" \
  --key-file "$HOME/.config/nopetion-backup/key" --snapshot latest
```

Choose a **new** target prefix and a **nonexistent** private configuration output directory outside the source and backup store. A dry run verifies all objects, reports missing cached images and confirms that every target volume is absent:

```sh
node scripts/restore.mjs restore --store "$HOME/NopetionBackups" \
  --key-file "$HOME/.config/nopetion-backup/key" --snapshot latest \
  --target-prefix nopetion-recovery-001 --config-out "$HOME/NopetionRecovery001"
```

Execute only against those fresh targets:

```sh
node scripts/restore.mjs restore --store "$HOME/NopetionBackups" \
  --key-file "$HOME/.config/nopetion-backup/key" --snapshot latest \
  --target-prefix nopetion-recovery-001 --config-out "$HOME/NopetionRecovery001" \
  --execute --confirm-target nopetion-recovery-001
```

On a destination with an empty image cache, add `--load-images` to the executed restore command. This explicitly imports only the authenticated archived image IDs before creating new volumes; omit it to require preinstalled exact images. No network image pull occurs.

Even an existing **empty** volume is refused. Volume creation uses a unique operation label and rechecks that label before writing to avoid an existing-name race. PostgreSQL restoration runs in a temporary container with `--network none`, no published port, and `pg_restore --exit-on-error --single-transaction`. Only that operation's helper containers are removed. Source volumes and containers are not used as restore targets.

The output directory contains:

- `source-files/`: the original `.env` and labeled Compose files;
- `.env` and `effective-environment.json`: original values and the actual deployed environment;
- `compose.restore.json`: exact cached image IDs and the five new external volumes, with no published ports;
- `restore-pending.json` and `restore-result.json`: operation ownership and completion records.

The generated Compose file is a **review artifact**. It preserves the old effective `APP_URL`, OAuth callback and other values; it does not choose a new hostname or port for you. Application startup, routing, and any operating-instance switch require a separate reviewed deployment step. Keep the configuration directory private.

Effective values in that generated Compose file escape literal `$` characters as `$$` to prevent a second interpolation by Compose. The original files and `effective-environment.json` retain their exact bytes/values. When reviewing a future startup, use an explicit Compose project name matching the new target: an original `.env` can contain `COMPOSE_PROJECT_NAME`, which otherwise takes priority over the generated file's project name. These scripts themselves never start the restored application.

This escaping follows [Compose interpolation rules](https://docs.docker.com/reference/compose-file/interpolation/). The local read-only Compose regression parses literal `$NAME`, `${OTHER}` and `$$` values against deliberately conflicting variables and verifies preservation without creating containers or volumes. Compose's rendered `config` output re-escapes dollars; the test decodes that display layer once, matching the [Compose serializer](https://github.com/docker/compose/blob/main/cmd/compose/config.go).

A failed/interrupted restore leaves its new volumes and journal for inspection. It never clears or reuses a partly restored database. Use another new prefix/output directory for a retry. After `SIGKILL`, a network-isolated temporary restore/helper container may remain; inspect its exact `nopetion.backup.operation` label against the private journal before stopping that helper. Never run broad container/volume deletion commands. No automated restore pruning or reset command is provided.

## Storage and retention

Compression and encrypted object reuse avoid repeatedly copying unchanged attachment, AI and connector volumes. Snapshot manifests are small and share objects. Interrupted captures can be reused once revalidated. Entire-object deduplication also applies to byte-identical database/Redis captures, but a custom dump can contain changed timestamps and Redis can rewrite persistence files; do not assume semantic database deduplication or a fixed storage reduction.

Existing snapshots and objects are **never deleted automatically**. A source change during optimistic pre-copy or a crash can leave an unreferenced encrypted object; it is intentionally retained. Capacity planning must allow for the current dump, changed volumes, interrupted captures, and all snapshots retained. This version has no retention-prune command. Copy the private store as a unit to protected/offsite storage; immutable object and snapshot files can be copied incrementally. Keep a usable key copy separately and verify a selected snapshot after copying. Avoid copying a partially published latest pointer as your only recovery record; pin and verify a snapshot ID.

## Daily backup schedule

Use Node 24 installed on the Docker host. Keep the source scripts at a stable location. Inspect the plan first, then install only during an authorized maintenance window:

```sh
node scripts/backup-schedule.mjs install --project nopetion --project-dir "$PWD" \
  --store "$HOME/NopetionBackups" --key-file "$HOME/.config/nopetion-backup/key"
node scripts/backup-schedule.mjs install --project nopetion --project-dir "$PWD" \
  --store "$HOME/NopetionBackups" --key-file "$HOME/.config/nopetion-backup/key" \
  --hour 4 --minute 30 --execute --confirm-project nopetion
node scripts/backup-schedule.mjs status --store "$HOME/NopetionBackups"
```

The user crontab runs daily at 04:30 in the host's local timezone. It preserves unrelated jobs, creates a key only when absent and never replaces an existing key. Each run creates and independently verifies a snapshot, then records `backup-status.json`. Errors are recorded without printing credentials. Review this status and the private `scheduler.log`; installation alone does not prove a scheduled run succeeded. The schedule briefly stops only this project's app and Redis, just like a manual backup. It resumes its own interrupted operation safely and never prunes data or backups. Suspend the schedule during source-directory replacement and retain the old scripts until an interrupted operation is resolved.

Keep an encrypted store copy on a separate device and retain a protected key copy separately. Copy immutable objects before publishing the selected snapshot manifest, then verify that exact snapshot on the destination. Do not use mirroring options that delete previous snapshots.

## Verification without operating data

```sh
node --test tests/backup.test.mjs tests/backup-docker.test.mjs
```

The Node tests cover encryption/tamper detection, incomplete producers, deduplication, manifest binding, unsafe tar input, key permissions/location, stale locks, strict Compose ownership, remote storage rejection, target separation and CLI execution defaults. Docker QA is skipped unless explicitly enabled:

```sh
NOPETION_DOCKER_QA=1 node --test tests/backup-docker.test.mjs
```

The separate read-only Compose parser check does not need Docker daemon access:

```sh
NOPETION_COMPOSE_QA=1 node --test tests/backup-compose.test.mjs
```

That QA creates a new UUID project, toy Node app, PostgreSQL and Redis with no network or ports and no paid AI worker. It writes only fixture documents, a queue item, an AI key and connector/attachment bytes; exercises backup, verification, reuse, crash recovery, dry runs, and restore; then compares the restored state. It also verifies that existing-target overwrite is refused and source container/volume identities remain unchanged. Set `NOPETION_BACKUP_QA_APP_IMAGE` to another locally cached Node 24 + GNU tar image if needed. The harness stops/removes only its own labeled QA containers and **retains** its volumes, private backup, key and configuration for review. Its printed private artifact directory contains `qa-resources.json`; it prints no credentials. This is fixture backup/restore coverage, not a test of a real user's active editor or external provider recovery.

On 2026-10-18 the root agent executed this Docker QA successfully: one test passed, no skips, approximately 39.3 seconds. The restored PostgreSQL row, Redis queue, attachment bytes, AI key, connector bytes, `APP_SECRET` and database password matched the fixtures; object reuse, interrupted-backup recovery, dry runs and existing-target rejection also passed. Its source/destination QA volumes and private artifacts were retained. Subsequent read-only recovery-plan handling, CLI key location checks and generated Compose dollar escaping are covered by the Node tests. See the nonsecret [verification summary](verification/2026-10-18/personal-phase4/backup/summary.json).

## MCP permissions

Document read/write MCP credentials do not authorize full backups, credential export, restore, reset or deployment. Exposing these privileged operations would require separate administrative scopes, explicit project/target confirmation, private encrypted outputs and an audit trail. This change adds local operating tools only and does not broaden the existing MCP token permissions.
