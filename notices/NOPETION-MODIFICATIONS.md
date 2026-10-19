# Nopetion modification notice

Nopetion is a modified personal-use fork of Docmost 0.96.0. It is not an official Docmost release.

Modified during 2026-10-10–2026-10-19. Changes include personal account and workspace flows; Nopetion branding; CE document/database UI; document save confirmation; PDF export; separately configured AI and connectors; offline editing and synchronization; classification; page decoration; and self-hosted deployment tools. The 2026-10-18 changes also remove cloud storage drivers, mail delivery, email password recovery and optional personal UI entries, and move Draw.io, Gotenberg and iframe settings into owner-managed application settings.

The core remains subject to the root AGPL-3.0 license. Existing upstream copyright, license and disclaimer notices are retained. Source attribution and the upstream revision are recorded in docs/upstream-readme.md and docs/upstream-source.json.

Enterprise paths have separate terms. Commercial implementations were removed; their original license notices remain. This notice does not relicense Enterprise code or third-party dependencies and does not claim that the entire tree is AGPL. Third-party notices are under notices/third-party and notices/local-transcription. Source releases exclude installed dependencies and prebuilt images; image redistribution requires its own package and corresponding-source review. See docs/source-release.md.

- 2026-10-18: Add explicit public subpath builds, router/API/WebSocket/attachment URLs, scoped authentication cookies and PWA shell isolation while preserving internal routes and document identifiers.

- 2026-10-18: Bind HTTP and realtime credentials to revocable canonical sessions; stop trusting forwarded client-IP headers; redact OAuth credentials from request logs; update vulnerable runtime dependencies and remove unused commercial integration dependencies; correct Apache attribution and supply full vendored notices; add clean source export and an in-app corresponding-source download.

- 2026-10-18: Preserve native typing at React link-mark boundaries in the document model, including wrapped composition text, while retaining external URLs and logical internal-link paths.

- 2026-10-18: Remove the header-derived IP plugin; use validated socket addresses for audit/session metadata and reject invalid inet values before session inserts.

- 2026-10-18: Make locally served Pretendard the default application font and add a saved account font preference; preserve document font overrides and code typography.

- 2026-10-19: Keep document video controls interactive before metadata loads on iOS, enable inline playback, resolve authenticated attachment URLs under the app mount, and retain responsive video proportions without rewriting stored document URLs.

- 2026-10-19: Use a readable minimum size for touch-device text inputs and editable fields to avoid focus zoom while preserving manual viewport zoom and desktop typography.

- 2026-10-19: Guard offline navigation until durable edits are flushed; provide device-storage persistence controls and explicit pending-edit recovery exports; keep RAM editors mounted when storage fails. Preserve subpath AI settings links and add a restricted numeric-loopback SSH login bridge with state-bound callbacks. Bound Redis health connections and close them on every outcome. Preserve exact encrypted runtime images for cold-cache restoration, add a native daily backup scheduler, and deliver shutdown signals through Docker init directly to Node. Preserve publisher declarations and unmodified license references while recording unresolved original-notice gaps explicitly.

- 2026-10-19: Keep connected remote/mobile AI settings on the current server, hide computer-only loopback addresses until an explicit setup guide is opened, and remove unusable local-login actions from the remote screen.
