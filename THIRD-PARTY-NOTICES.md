# Third-party software

Original Gather code is MIT-licensed. No legacy repository code was copied or relicensed.

Cargo.lock pins the following Rust packages. The bundled license and notice texts are retained under licenses/, including upstream copyright notices. MIT is the selected alternative where offered; for unicode-ident, the additional Unicode-3.0 terms are included. Apache texts are retained where packaged alongside MIT. This is not a claim to include every optional alternative license file. Build-time and target-dependent packages may not be present in the browser artifact.

| Package | Version | Declared upstream license |
| --- | --- | --- |
| base64 | 0.22.1 | MIT OR Apache-2.0 |
| block-buffer | 0.10.4 | MIT OR Apache-2.0 |
| cfg-if | 1.0.5 | MIT OR Apache-2.0 |
| cpufeatures | 0.2.17 | MIT OR Apache-2.0 |
| crypto-common | 0.1.7 | MIT OR Apache-2.0 |
| digest | 0.10.7 | MIT OR Apache-2.0 |
| generic-array | 0.14.7 | MIT |
| itoa | 1.0.18 | MIT OR Apache-2.0 |
| libc | 0.2.190 | MIT OR Apache-2.0 |
| memchr | 2.8.3 | Unlicense OR MIT |
| proc-macro2 | 1.0.107 | MIT OR Apache-2.0 |
| quote | 1.0.47 | MIT OR Apache-2.0 |
| serde | 1.0.229 | MIT OR Apache-2.0 |
| serde_core | 1.0.229 | MIT OR Apache-2.0 |
| serde_derive | 1.0.229 | MIT OR Apache-2.0 |
| serde_json | 1.0.151 | MIT OR Apache-2.0 |
| sha2 | 0.10.9 | MIT OR Apache-2.0 |
| syn | 3.0.6 | MIT OR Apache-2.0 |
| typenum | 1.20.1 | MIT OR Apache-2.0 |
| unicode-ident | 1.0.26 | (MIT OR Apache-2.0) AND Unicode-3.0 |
| version_check | 0.9.5 | MIT/Apache-2.0 |
| zmij | 1.0.23 | MIT |

There are no third-party UI frameworks, remote fonts, image downloads or tracking scripts. Browser tests use the pinned Playwright 1.62.1 development package (Apache-2.0), which is not shipped in web/. Synthetic JPEG and PDF fixtures were generated for the demo using Pillow and ReportLab; those tools are not shipped or runtime dependencies.

## Rust standard library

The pinned Rust 1.99.0 standard-library notices are retained verbatim in licenses/rust-1.99.0/COPYRIGHT-library.html and served as web/RUST-STANDARD-LIBRARY-NOTICES.html. The standard library is licensed under MIT or Apache-2.0 except as noted in that upstream notice; embedded upstream component notices are preserved. The static verifier checks the exact notice digest and source/distribution parity.
