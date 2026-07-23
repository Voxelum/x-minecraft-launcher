# M9 xmcl-page checklist

- [ ] Treat this directory as a proposal only; do not implement a client until the shared owner publishes `m9.modpack-deployment.v1`.
- [ ] Reuse the site M1 session and shared commercial API client; do not create another account or token store.
- [ ] State publicly that uploaded JAR/native executable/script payloads and arbitrary mod URLs are rejected.
- [ ] Explain that accepted mods are resolved server-side from Modrinth or CurseForge project/file IDs and pinned hashes.
- [ ] The browser never parses an archive as authority, downloads provider mods, calls internal worker routes, or receives provider/worker secrets.
- [ ] Display server validation report sections for config, data, resolved mods, and every rejected item.
- [ ] Bind apply confirmation to the published preview/manifest hash and expose apply failure plus snapshot rollback outcomes.
- [ ] Handle expired upload URLs, permission failures, validation failures, task retry, stale preview, and rollback failure without losing report context.
- [ ] Add page-repository unit/component tests and responsive visual evidence under that repository's contributor contract.# M9 xmcl-page publication checklist

- [ ] Wait for `m9.modpack-deployment.v1` publication; do not implement a client against this proposal identifier.
- [ ] Reuse the site M1 session and published commercial API client; do not create another account or token store.
- [ ] Explain supported mrpack/CurseForge ZIP formats, manifest/config/data allowlist, archive limits, and provider-only mod policy.
- [ ] State clearly that jar/exe/dll/so/scripts and arbitrary download URLs are rejected and never executed.
- [ ] Browser code uploads only to a server-issued signed URL and displays only the server validation report; it performs no source trust decision or mod download.
- [ ] Preview displays config/data/mod added, changed, and removed sets before apply confirmation.
- [ ] Invalid imports, provider outage, incompatible template, apply failure, hash mismatch, and missing rollback snapshot have actionable non-secret copy.
- [ ] Rollback copy states that the prior config/data snapshot is restored and does not imply a metadata-only change.
- [ ] Unknown enum/error values degrade to a recoverable generic state without treating the deployment as valid.
- [ ] No provider token, worker token, signed URL, uploaded manifest content, or raw provider error appears in storage, analytics, or logs.
- [ ] Run the page repository's typecheck, unit/contract tests, responsive visual checks, and contributor-required screenshot workflow once that repository is available.