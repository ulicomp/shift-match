# Fixed app shell, scrolling content

Goal: remove the "card inside a card" frame. The sidebar, logo, and top bar sit directly on the page background; only the page content area scrolls. Colors and fonts stay exactly as they are.

## Layout changes
- Remove the outer rounded bordered frame and its margin; the shell fills the full browser window edge to edge.
- Sidebar (logo, menu icons, profile, avatar) is pinned on the left for the full window height and never scrolls.
- Top bar (page title, search, notifications, settings, help, "Log cancellation") is pinned at the top and never scrolls.
- Only the content area below the top bar and right of the sidebar scrolls; the rounded cards inside keep their current look.
- Inner cards that already scroll (lists, columns) keep their own scrolling on wide screens.

## Professional polish
- Sidebar: logo pinned at top, menu items grouped right under it (not floating in the middle), profile and avatar pinned at the bottom; clear active state indicator.
- Thin divider lines (using existing border color) separating sidebar and top bar from content, so the shell reads as one app frame.
- Top bar: consistent height, search stays centered and usable at all widths; on medium screens hide only secondary icons, never search or settings.
- Keyboard shortcut: "/" or Cmd/Ctrl+K focuses the search box, with a small hint shown inside it.
- Visible focus rings on sidebar and top bar buttons for keyboard users.

## Smaller screens
- Tablet: same pinned shell, narrower sidebar; content scrolls inside.
- Phone: sidebar becomes the existing slide-out menu; a compact top bar (logo, search, menu button) stays pinned at the top while content scrolls beneath.

## Technical details
- `src/styles.css`: `.app-frame` becomes `height:100dvh; margin:0; border:0; border-radius:0; overflow:hidden`; `.rail` gets `justify-content:flex-start`, bottom group via `margin-top:auto`, right border; `.top-bar` gets bottom border/padding; `.page-content` is the sole `overflow:auto` region with padding. Remove `overflow: visible`/`height:auto` overrides in the 960px and mobile breakpoints so the shell stays fixed at every size.
- `src/components/AppShell.tsx`: restructure rail into top (logo + nav) and bottom (profile + avatar) groups; add search input ref + keydown listener for "/" and Cmd/Ctrl+K; mobile header shows search.
- No data, color, or typography token changes.
