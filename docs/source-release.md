# Source releases

Nopetion's release format is a CE source archive. It contains the monorepo, build instructions, locked dependency declarations, original attribution, modified-source notices and the original Enterprise license documents. Commercial implementations, installed dependencies, compiled assets, container images, private verification evidence, real environment files, data and backups are excluded.

## Create a source candidate

Run the project checks and `pnpm audit --prod`, then create a new archive outside the checkout:

```sh
node scripts/check-public-source.mjs --working-tree
node scripts/package-server.mjs --public --out /absolute/path/nopetion-source.tar.gz
```

Verify the `.sha256` sidecar, extract into an empty directory and run the source checks there. `PUBLIC-SOURCE.json` lists the hash of every included source file. Build and run from that extracted source before publishing it. The archive has no Git history. If creating a public repository, initialize a fresh history from the verified extracted files. If your checkout still contains upstream Git history, do not push it: historical commits can retain separately licensed commercial sources after deletion from the working tree.

## Prepare a GitHub upload

Use the extracted source directory as the new repository. Its `.gitignore` excludes real environment files, local credentials, operating data, backups, browser sessions, build/test output and private verification notes. It keeps `.env.example`, the lockfile, license notices, translated documentation and the curated README video/images available for version control.

Before staging, inspect the files Git would include and check for already-tracked ignored files:

```sh
git status --short --untracked-files=all
git ls-files -ci --exclude-standard
node scripts/check-public-source.mjs
```

Review the staged filenames and diff before committing. Ignore rules affect untracked files; they do not remove secrets or commercial code from existing commits and do not replace a secret scan. If the second command lists files, review them before explicitly removing only the intended paths from the index. Preserve an existing checkout's index and history unless its owner explicitly requests a reset.

## License scope and source access

The core is covered by the root [AGPL-3.0](../LICENSE), with the original upstream attribution in [the upstream README](upstream-readme.md) and [revision record](upstream-source.json). Modifications are described in [the modification notice](../notices/NOPETION-MODIFICATIONS.md). Separate Enterprise documents are retained as historical notices, with their implementations excluded. Third-party code and fonts retain their own terms; the entire tree is not relicensed as AGPL.

Docker builds embed a source archive generated from the exact build tree. Settings link to `/api/legal`, which provides that archive and the AGPL text without requiring an account. This gives people interacting with a modified server a way to obtain its corresponding application source. Rebuild the image whenever source changes. Keep that source download available to the users who can reach the server.

## Prebuilt images and dependency distributions

This source release does not distribute `node_modules`, compiled browser bundles, the Whisper executable/model, Debian libraries or FFmpeg. Installation retrieves dependencies from their original publishers. Package license declarations and notice collection are evidence, not a blanket license clearance for every resulting binary.

Publishing a prebuilt image is a separate distribution task. Inventory its actual architecture-specific packages, preserve the required copyright and license notices, resolve missing package-level notices, and provide corresponding source/build material for applicable copyleft components (including the actual FFmpeg build and Debian packages). The current source candidate does not approve public container-image publication. Private build/runtime test images are not public release artifacts.

## Release evidence

Keep an external record of the archive checksum, source file manifest, runtime image ID, advisory scan date, executed tests and unresolved limits. Private screenshots, logs, personal hosts and deployment overrides belong outside a public repository. Physical phone tests and external provider logins must not be reported as passed when only browser emulation or local fixtures were used.
