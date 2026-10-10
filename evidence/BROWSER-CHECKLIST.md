# Gather browser check

Serve the `web` directory and run these checks against its base URL.

1. Fresh load: sample heading, clear browser-local label, 2/5 accepted, 40%, five items, role switch.
2. Owner → Website copy → Accept. 3/5 accepted. Reload persists. Reopening accepted asset offers request changes, not acceptance again.
3. Owner → Brand guidelines → Request changes: empty feedback rejected; cancel does not change state. Add feedback; request revision. 2/5.
4. Recipient → Brand guidelines → Use synthetic sample → Submit. Owner → review version 2 → accept. 3/5. Earlier version not exported.
5. Recipient → Project details: choose .html, empty .txt, >2 MiB file; errors, no accepted status. Escape/cancel retains state. Choose valid .txt, submit. Same for Team photography, then owner accepts each.
6. Export partial packet before completion, then complete packet. Downloads contain actual accepted bytes and matching SHA-256, no rejected/missing files. Manifest-only omits base64 bytes. Filenames include item prefixes. Complete flag correct.
7. Two tabs: open same submitted item in both. First accepts; second must show revision conflict and reload latest state, not overwrite it.
8. New packet: missing titles fail, cancel retains previous packet. Custom packet with 1 requirement succeeds, starts in Recipient view with no accepted files/export disabled. Test text resembling HTML stays text.
9. Reset: cancel retains current packet; confirm restores sample. Reload verifies reset.
10. 360/390/768/1440 px widths: no horizontal overflow, role buttons and creation reachable, dialogs usable, keyboard focus visible, Escape closes and returns focus, console clean. Real phones/Safari are untested unless separately run.

`tests/browser.cjs` automates these checks with Playwright in a supported browser. Do not mark it passed without executing it.

Revision-2 additions: inspect aria-pressed true/false and active-role style; verify focus after role/filter changes, accepted item disappearing under a filter, Escape/cancel/success, reset/create and requirement removal. Exercise a slow valid read immediately replaced by an invalid file or cancelled panel, then resolve the old read. Confirm no stale file can submit. Burst export clicks must initiate one operation and retain no more than one Blob URL. Physical/phone export responsiveness remains unmeasured.
