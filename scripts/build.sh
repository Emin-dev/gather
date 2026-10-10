#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
cargo test --locked
# Keep distributed panic/source locations reproducible and machine-independent.
RUSTFLAGS="${RUSTFLAGS:-} --remap-path-prefix=$PWD=. --remap-path-prefix=${CARGO_HOME:-$HOME/.cargo}=cargo-cache --remap-path-prefix=${RUSTUP_HOME:-$HOME/.rustup}=rust-toolchain" \
  cargo build --locked --release --target wasm32-unknown-unknown
cp target/wasm32-unknown-unknown/release/gather_core.wasm web/gather_core.wasm
node scripts/verify-build.mjs
