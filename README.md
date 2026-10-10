# Gather

Project assets, together. A bounded **browser-local demonstration** of agency asset collection: create a packet, request specific items, submit files as a simulated recipient, review as a simulated owner, request a new version, accept it, and export only accepted work.

## What actually works

- Rust domain library is compiled to WebAssembly and runs in the browser. JavaScript only handles DOM, browser file reads, IndexedDB and downloads; workflow transitions, constraints, signature checks, byte hashes and accepted-file export are Rust.
- Templates and 1–12 custom requirements, with per-item instructions and supported file types.
- Recipient submission of bounded local files, owner acceptance, required revision feedback, resubmission with increasing versions, accepted-version locking and explicit reopening.
- Reload resumes completed local submissions from IndexedDB. Atomic revision checks reject stale writes from another tab. **This is not a network-resumable upload implementation.**
- Actual accepted bytes exported as base64 in a portable JSON packet, SHA-256 manifest, unique item-prefixed names, complete/incomplete flag, exact versions. Manifest-only export is separate. Unaccepted files are excluded.
- Keyboard-operable dialogs, responsive owner and recipient controls, inert text rendering, visible validation, cancel/reset flows and synthetic fixtures.

## Honest scope

There is **no shared server, account, recipient invitation, real client access control, multi-device sync, S3, ZIP download, electronic signature, malware scanning or production audit log**. Both views belong to the same local browser user. The static site does not upload selected files or fetch remote assets. Hosting naturally receives ordinary page/asset requests. Do not put confidential, personal, regulated or irreplaceable material into this demo.

A future owner-hosted Rust service needs authentication/authorization, real resumable object upload, server-side revision enforcement, durable storage and backups, quotas, malware isolation, tenant separation, trusted audit identity and signed review records. Rust UI is a separate future decision; this prototype uses thin plain-JavaScript UI glue with a real Rust/WASM domain core. No framework, UI package or third-party script is loaded.

## Limits and safety

- 1 packet in IndexedDB, 1 file per item, 12 requirements, 2 MiB per file, 6 MiB aggregate, 12 MiB JSON processing input.
- UTF-8 TXT/MD/JSON, PNG, JPEG, PDF; JSON parser validates syntax with its standard bounded nesting depth. Image/PDF checks only verify leading signatures. No complex media parser or automatic document rendering.
- Simple ASCII filenames, no hidden/path-traversal filenames, unknown request fields rejected. Exports are JSON rather than an automatically extracted archive.
- SHA-256 is computed from actual decoded stored bytes and revalidated before every transition or export. It establishes byte consistency, not creator identity or file safety.
- Stale packet revision and stale item version checks; repeated acceptance and unauthorized replacement states fail. Browser-local role switching is expressly not authentication.
- File reads can be cancelled; closed panels discard late results. A save commits atomically before success is displayed; reload restores the last completed save.
- Content Security Policy, no external scripts/fonts, no HTML rendering of submitted content, no service worker or background upload.
- IndexedDB is not encrypted at rest by this app. Clear/reset affects this browser's local packet only.

## Build and run

Prerequisites: the pinned Rust 1.99.0 toolchain with `wasm32-unknown-unknown` (rust-toolchain.toml), Node 20+, Python 3 for an optional static server.

```sh
rustup toolchain install 1.99.0 --profile minimal --component rustfmt --component clippy --target wasm32-unknown-unknown
./scripts/build.sh
python3 -m http.server 4171 --bind 127.0.0.1 --directory web
```

Open http://127.0.0.1:4171. WASM must be served over HTTP(S), not opened using a file URL. A verified prebuilt `web/gather_core.wasm` is included for static hosts; `npm run build` checks it executes, while `scripts/build.sh` compiles it from source. `Cargo.lock` pins Rust dependencies. The build script remaps project, Cargo-cache and Rust-toolchain paths before compiling the distributed WASM; the static verifier rejects common absolute machine paths in the artifact. The checked-in artifact must be rebuilt after core changes; evidence records both source and binary hashes.

```sh
cargo test --locked
cargo clippy --locked --all-targets -- -D warnings
cargo fmt --all -- --check
node --check web/app.js
node scripts/verify-build.mjs
node tests/wasm.cjs
node tests/dom-regressions.cjs
# Install the separate, lockfile-pinned browser test tools:
npm ci --prefix tests --ignore-scripts
# For a standalone supported machine, install the matching browser:
(cd tests && npx playwright install chromium)
# Point CHROMIUM_PATH to your supported browser, or supply BROWSER_CDP_URL:
GATHER_URL=http://127.0.0.1:4171 node tests/browser.cjs
```

Browser tests use Playwright 1.62.1 pinned in tests/package.json and tests/package-lock.json. They can connect to an authorized supported browser with BROWSER_CDP_URL; otherwise CHROMIUM_PATH overrides the pinned Playwright browser executable. Test dependencies are separate from production: Vercel explicitly skips dependency installation, sets framework to null, and only executes the no-dependency static verifier. Never treat an unexecuted browser suite as a UI pass.

## Deployment

`vercel.json` serves `web` as a static demo and sets security headers. `node scripts/verify-build.mjs` checks the included Rust WASM at build time. No paid database, token, secret, serverless upload endpoint or external integration is needed. Publication is coordinated separately after review; this source folder does not claim a live deployment.

## Provenance

Original implementation for this demo. No existing repository code, private data, branding or assets were copied. The listed client and assets are fictional synthetic examples.

Rust dependencies: serde and serde_json (MIT/Apache-2.0), base64 (MIT/Apache-2.0), sha2 and transitive RustCrypto crates (MIT/Apache-2.0 where declared). See `Cargo.lock` for exact resolution. All visual styling and simple line icons are original. Fonts use local system faces only.

## Verification

See `evidence/VERIFICATION.md` and the test logs. Native/WASM tests are separate from browser UI checks; unrun or blocked stages are labelled explicitly. Current product differentiation and willingness to switch remain unproven; the demo is a workflow experiment, not a demand or production-readiness claim.
