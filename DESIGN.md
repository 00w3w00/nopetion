# Design

## Source of truth
Status: Active. Updated: 2026-11-04. Surfaces: personal workspace, document editor, navigation, block menus, inline databases, AI writing and preview. User direction: make existing Nopetion look and behave much closer to Notion, including automatic hover outline. Evidence: README, docs/notion-parity.md, personal-editor.module.css, personal-sidebar, page-header, slash-menu, database-view, existing browser screenshots under .omx/ui-preview. Official reference: https://www.notion.com/help/customize-and-style-your-content and https://www.notion.com/help/navigate-with-the-sidebar. Exact current-product pixel parity is not established.

## Brand
Quiet, document-first, familiar productivity UI. Keep Nopetion identity. Avoid decorative dashboard styling, saturated surfaces, excessive rounded cards, duplicated navigation and fake controls.

## Product goals
Make everyday writing, hierarchy navigation, block insertion and database editing feel coherent and predictable. Success: readable document measure, restrained chrome, hover controls with keyboard access, preserved data/permissions. No new collaboration/public sharing or external integrations in this visual pass.

## Personas and jobs
Single-owner workspace user writing Korean notes, organizing nested pages, tracking projects; desktop writing with mobile reading/editing.

## Information architecture
Existing routes and data remain authoritative. Sidebar: account/workspace, search/home, favorites, personal pages, utility links. Document: slim breadcrumb/action header, optional cover/icon, large title, body, automatic right-hand outline. Inline databases stay within documents.

## Design principles
Content outranks chrome. Reveal secondary actions on hover/focus but retain touch access. Use semantic controls and existing services. No decoration that implies unsupported behavior.

## Visual language
White #fff document, warm-gray #f7f7f5 sidebar, #37352f text, #787774 muted text, #e9e9e7 borders; dark document #191919/sidebar #202020. Blue #2383e2 for links and active actions. Body 16px/1.5, title 40px, H1/H2/H3 30/24/20px. Default readable content width around 708–760px with sufficient horizontal gutters; full-width mode must still work. Header 45px, sidebar rows 30–32px. Controls radius 4–6px; floating menus 8–10px, soft subtle shadow. Existing fonts and Tabler icons only. Respect reduced motion.

## Components
Reuse Mantine and Tiptap, current theme and feature CSS modules. Sidebar/header/action menus are compact and neutral. Slash commands show icon, title and short description, grouped and keyboard navigable. Database views use a recognizable active view control, discrete toolbar and restrained grid/status styling. Personal documents do not show a persistent formatting toolbar; selection formatting and slash commands remain the editing entry points. Floating outline appears without pressing a menu and expands on hover/focus; lower-level headings indent.

## Accessibility
Keyboard interaction and visible focus on every interactive control. Name icon-only buttons, reflect expanded/selected/disabled state, preserve read-only boundaries, avoid unreadably faint body copy. Target WCAG AA; formal full audit not yet performed.

## Responsive behavior
Desktop >= 62em may show automatic outline; smaller widths keep explicit accessible menu fallback. Sidebar overlays on mobile. Text, title and database controls must not cause whole-page horizontal scrolling; wide database grids scroll inside their container. Hover controls remain visible on coarse pointers. Minimum useful touch areas around 40px for primary mobile actions.

## AI interaction
AI receives the authorized current page title, bounded document context (including visible inline database records), selection, and explicit writing instruction. Default flow: select or open AI → request → read-only structured preview → insert or replace / retry / discard. Direct background insertion is an explicit mode. Preserve source snapshots, readonly boundaries and page identity. Never imply access to other pages or attachments. Show the reference page and explain excerpting.

## Interaction states
Preserve real loading/error/retry/empty/pending/save states. No permanent saved indicator can substitute for actual save status. Empty editor offers real insertion paths. Menu selection, filter changes and record editing must remain functional.

## Content voice
Concise Korean via existing i18n; use existing labels whenever possible. Technical implementation details stay out of normal UI.

## Implementation constraints
React 19, Mantine 9, Tiptap 3, CSS modules, current dependencies only. Preserve prior working changes and personal/nonpersonal behavior. Each lane owns disjoint files. Before completion: targeted interaction tests, full client typecheck/tests/build, scoped lint and desktop/mobile/dark browser checks; then refresh existing local server. Fixture QA must be identified as fixture QA, never a real authenticated end-to-end result.

## Open questions
- [ ] Exact Notion release/layout baseline is not supplied; owner: user. Use familiar document-first Notion behavior and official references, not a claim of exact product equivalence.
- [ ] Authenticated user-session verification may require a logged-in browser; owner: integration. Do not reset the user's account or invent credentials to obtain it.
