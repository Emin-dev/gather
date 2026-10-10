# Gather implementation verification

Writer verification date: 2026-10-09. This is the revision-4 source freeze after independent source findings. See REVIEW-FIXES.md.

## Executed and passed

- Rust 1.99.0 stable; wasm32-unknown-unknown target.
- `cargo test --locked`: **15/15** native unit tests passed. Workflow and exact export oracle, state tampering, extension/content mismatch, path traversal, malformed/unknown JSON, UTF-8/null checks, per-file/aggregate/count limits, complete/partial exports, required feedback, repeated review, stale packet and item versions.
- `cargo clippy --locked --all-targets -- -D warnings`: passed.
- `cargo fmt --all -- --check`: passed.
- `scripts/build.sh`: pinned release WASM build with source/cache/toolchain path remapping passed. An offline clean build in another directory is byte-identical. The static verifier rejects common absolute machine paths.
- `node scripts/verify-build.mjs`: actual Rust WASM instantiated and sample command executed successfully. Binary: 264,933 bytes.
- `node tests/wasm.cjs`: **17/17** WASM integration checks passed, including real decoded-byte SHA-256 comparisons against Node crypto, a full 6 MiB packet with 2 MiB files, aggregate overflow rejection, memory-growth recovery, 100 randomized malformed byte inputs, oversized ABI allocation rejection, and no stale request replay after rejected allocation.
- `node --check web/app.js` and `node --check tests/browser.cjs`: passed.
- Cargo.lock and zero-runtime-dependency package-lock.json recorded. Rust 1.99.0/wasm32 and the separate Playwright 1.62.1 test runner are pinned; standalone test dependency installation passed.
- `node tests/dom-regressions.cjs`: 15 production-source regression groups passed using deterministic stubs. These are not browser tests.
- Selected third-party license/notice texts (MIT alternatives and additional Unicode-3.0 terms) copied from installed pinned crates; static distribution includes `third-party-licenses.txt` and the unmodified pinned Rust 1.99.0 standard-library notice, with digest/parity checks.

## Not passed or claimed

- Browser UI and screenshot verification **not yet run**. Chromium could not initialize IPC in the test environment. Hosted browser verification remains pending.
- `tests/browser.cjs` and `BROWSER-CHECKLIST.md` are ready for that route. They are a test plan, not execution evidence.
- No physical phone, Safari, screen reader, live multi-user server, network-resumable upload, production hosting, real client data or user-demand test is claimed.
- Independent review and hosted deployment checks remain separate from the implementation checks recorded here.

## Important scope

This is a browser-local workflow demo, not a shared client collection service. It uses a real Rust domain core and a small plain-JavaScript browser UI. Accepted packet exports contain actual accepted bytes and hashes, but review identities are simulated. Export files are JSON containers; there is no ZIP/S3 export or hosted Rust service.

## Freeze integrity

`SOURCE-SHA256SUMS.txt` lists source, build, static artifact, licenses and test files. `SOURCE-MANIFEST.json` identifies the snapshot. The folder is frozen until review feedback; any later change requires an updated manifest and relevant rechecks.
