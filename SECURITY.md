# Security

Nopetion is intended for one owner behind a private HTTPS proxy. Keep personal mode enabled. Public registrations, invitations, public sharing, cloud storage drivers, email delivery and email password recovery are unavailable in this fork.

Use a strong, unique password even though the personal password form accepts one character. Losing the password requires an administrator-assisted recovery from a secured backup; there is no email recovery service. Keep the database, Redis, attachment and AI storage private, and back them up together as described in [the backup guide](docs/backup-restore.md).

HTTP authentication and both realtime transports require an active canonical login session. Session revocation is checked on messages and by an idle connection watchdog; tokens alone do not keep revoked sessions alive. Old credentials without a session identifier require a new login. Explicit workspace owner bindings and document/attachment permissions remain enforced.

The HTTP server ignores forwarded client-IP headers. Behind a proxy, IP-based limits may therefore share the proxy's address. Do not enable blanket trust of forwarded headers to work around this. OAuth callback queries and sensitive credential parameters are removed from HTTP request logs.

For a vulnerability report, use the hosting repository's private security advisory feature when available. Avoid putting passwords, tokens, document content or working exploit credentials in public issues. If private reporting is unavailable, open an issue requesting a private reporting channel without disclosing the vulnerability.

Before a release, run `pnpm audit --prod`, the checks in [source releases](docs/source-release.md), and the relevant runtime tests. A passing advisory scan only describes the advisories available at that time; it is not a guarantee that the application has no vulnerabilities.

The build-only `braces@3.0.3` advisory GHSA-vfj7-8cjw-p6xm has no upstream patched release. The checked-in pnpm patch limits parser nesting and all three recursive AST walkers to 128 levels, including caller-provided ASTs. `tests/dependency-security.test.mjs` exercises deeply nested braces, parentheses and ASTs through the actual build dependency, plus normal globs. Advisory scanners still report that package version; it is not suppressed or counted as a clean scan. It is absent from production dependencies. Replace this patch when an upstream fix becomes available.
