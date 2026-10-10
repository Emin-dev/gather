# Gather dialog ownership and accessible field names

Local repair verification date: 2026-10-10. This records pre-publication local verification and does not establish remote CI, publication or deployment results. Earlier verification records describe their original snapshots.

## Exact baseline

- Accepted commit: `41e44e29c860cba7654376fe84f4db59faea5eed`.
- Accepted Git tree: `f7596fdd082f2281bd11be3693bb6f7a2f89bb56`.
- All 83 accepted blob identities and file modes were checked before editing this isolated copy. The accepted source and release archive were not edited.
- Runtime change is limited to `web/app.js`. Rust source, WASM, styles, deployment configuration, dependencies and CI workflow are unchanged.

## Repair

Each dialog opening has a unique body. Submission, acceptance, revision requests, packet creation and sample reset now check that body still belongs to the open dialog before applying success/error UI, closing, moving focus or resetting role/filter. A completed storage mutation is retained even if its initiating dialog was dismissed. The file-read generation cannot serve as this ownership token because successful mutations advance that generation themselves.

Normal current-dialog success still closes and confirms. Current-dialog failures remain visible and retryable. Closing, replacing or returning from a revision editor invalidates the older completion. Request changes cannot open an in-place feedback editor while acceptance is still saving; it remains available after the save completes.

The visible phrases for client/team, template, item title, recipient instructions, allowed types and revision feedback now appear verbatim in their accessible names. Repeated requirement fields append an item number.

## Executed on the repaired source

- JavaScript syntax for the runtime and all affected test files: passed.
- `node tests/dom-regressions.cjs`: 15 existing checks plus 46 new dialog/name source-shim checks passed.
- Negative control: the same 46 new assertions against the exact accepted `web/app.js` failed 31 and passed 15. This includes all five stale-success closes, late detached errors, role/filter resets, revision Cancel/Back, same-body revision transition and label mismatches.
- New checks cover deferred success and failure, Close then reopen, direct dialog replacement, dismissal without reopening, repeated clicks, current save success, current save failure/retry, revision Cancel/Back, preserving all typed fields and focus, then successfully saving the newer draft, and unique field names after adding/removing requirements.
- `node scripts/verify-build.mjs`: passed.
- `node tests/wasm.cjs`: 17 integration checks passed.
- `cargo fmt --all -- --check`: passed.
- `cargo test --offline --locked --all-targets`: 15 native tests passed.
- `cargo clippy --offline --locked --all-targets -- -D warnings`: passed.
- `CARGO_NET_OFFLINE=true bash scripts/build.sh`: passed, including native tests and pinned WASM rebuild. The rebuilt WASM is byte-identical to the accepted artifact.

## Browser limit, not a pass

A local Playwright launch of the installed Chromium failed before opening a page: Chromium's process singleton reported `socket() failed: Operation not permitted`. No permission/security workaround was attempted. No new browser, native IndexedDB, layout, native focus, accessibility-tree, screen-reader, voice-control or hosted-page execution is claimed for this repair.

`tests/dialog-browser.cjs`, called automatically by the existing browser suite, adds seven real-browser checks for the five save actions, revision Cancel/Back, and field names after add/remove. It delays delivery of a real IndexedDB transaction's completion event without changing production source, then verifies new input/focus remains and the saved state survives reload. Those checks are prepared and syntax-checked, but unexecuted here. Existing browser selectors were synchronized to the corrected accessible names.

On a supported browser, run the existing documented server and `GATHER_URL=http://127.0.0.1:4171 node tests/browser.cjs`. Independent source review and any future publication are separate gates.
