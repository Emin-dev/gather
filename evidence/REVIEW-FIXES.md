# Gather review fixes, revision 2

Date: 2026-10-09. Changes are local to Gather; no remote changes.

- **Logic stale file-read race:** every selection increments its own token and aborts the prior reader *before* size validation. Both success and failure check the selection token, panel generation and open-dialog state. Empty replacement file lists cancel selection. Invalid zero-byte/oversized replacements cannot resurrect a previously reading file.
- **G1 role state:** ARIA values serialize as explicit `true`/`false` strings. Ordinary HTML boolean attributes retain HTML semantics. Active role selectors now match.
- **G2 focus continuity:** role/filter controls and item openers have stable focus keys. Page rerenders restore an equivalent visible control when appropriate. Dialogs remember a logical opener and restore it after success, cancel or Escape, falling back to the assets heading when the item disappears from the filter. Removing a requirement focuses the neighboring remaining title field. Browser tests now assert these flows; actual browser/AT verification remains pending.
- **G3 status contrast:** changes-requested text is now #934c29 on #f9eae1: computed authored contrast 5.409:1 (previously 4.363:1). This is a source-derived color calculation, not screenshot sampling or comprehensive WCAG certification.
- **Download resource bounds:** one live Blob URL and one cleanup timer maximum; subsequent spaced downloads revoke their predecessor. A 750 ms burst guard runs before export work. An async export guard prevents overlapping IndexedDB/core work. Page exit releases the live URL. Download feedback says requested, rather than claiming browser persistence.
- **Build reproducibility:** Rust 1.99.0 and WASM target are pinned in rust-toolchain.toml; Cargo declares rust-version 1.99. Playwright 1.62.1 is pinned separately under tests/ with its lockfile. `npm ci --prefix tests --ignore-scripts` was executed successfully, without installing or launching browser binaries. Vercel explicitly selects no framework and skips dependency installation, so the browser test tools are not production dependencies.
- **License wording:** documentation specifies MIT-selected alternatives, additional Unicode-3.0 terms, and accompanying Apache texts. It no longer claims every optional alternative license file is bundled. Static build checks require the served license bundle.

## Executed checks

15 native Rust tests, 17 WASM integration groups, strict Clippy, formatting, JavaScript syntax, standalone pinned test dependency installation and static build verification passed. `tests/dom-regressions.cjs` executes actual production-source functions against deterministic stubs: **14 groups passed**, including zero-byte/oversized replacements, success/error completions out of order, cancellation, ARIA attributes, focus-target selection, dialog close, authored contrast, 100 spaced/burst downloads and overlapping exports.

These stub tests are not a browser, DOM layout, accessibility tree, screen-reader or screenshot test. Browser tests/checklist remain pending the supported route. The bounded export remains synchronous; independent Node measurements (~100 ms at the maximum packet and ~70 MiB retained WASM high-water) do not establish phone or browser performance. No worker refactor was introduced without an executable browser regression route.

## Distributed artifact hygiene, revision 3

The release build remaps project, Cargo-cache and Rust-toolchain prefixes to portable paths. The rebuilt WASM is 264,933 bytes and contains no detected absolute machine paths. An offline clean rebuild in a different directory produced byte-identical output. Static verification now rejects common absolute machine prefixes before deployment. Native/WASM/DOM regression counts remain 15/17/14, with formatting, strict Clippy and syntax checks passing. Browser verification remains pending.

Artifact SHA-256: 84d413495164c96f71af2b269d5a232d79dd7c97d9c17218ea828e53fcf6c706.

Rust standard-library packaging: the unmodified Rust 1.99.0 notice is included in source and static output, with an exact SHA-256 check and source/output parity gate. Notice SHA-256: 5647be074c8edf7339fd863055923a8fc80bc5610a8d4661ec3b767b9d392c27.

## Nested review focus, revision 4

Cancelling a revision-request form now explicitly focuses the newly rendered Request changes button in the still-open review dialog, with the dialog heading as a fallback. The original page opener remains preserved for eventual dialog dismissal. Added a production-source regression covering render-before-focus and fallback behavior, plus a browser assertion that Cancel keeps the dialog open and focuses its review action. The source regression suite now has 15 passing groups; browser execution remains pending.
