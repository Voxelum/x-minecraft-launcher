# M9 XMCL App checklist

- [x] Keep archive/source validation as a pure domain function over entries parsed by the established ZIP library.
- [x] Reject embedded executable/script payloads and unresolved provider sources in the local policy projection.
- [ ] Wait for `m9.modpack-deployment.v1` publication before adding a remote API client or renderer workflow.
- [ ] Use the published M1 session and M4 server identifier; never send provider credentials, worker tokens, or account ownership fields.
- [ ] Upload only through the published signed-URL flow and display server validation as authoritative.
- [ ] Require an accepted preview hash and explicit confirmation before apply.
- [ ] Preserve recoverable states for upload expiry, validation rejection, task retry, apply failure, and rollback failure.
- [ ] Add renderer test IDs, a scratch Playwright spec, screenshots, renderer build, Electron compile, and scratch E2E when visible UI is introduced.# M9 XMCL App checklist

- [x] Add a pure archive/source policy validator over entries produced by the established ZIP parser.
- [x] Reject unsafe paths, symlinks, duplicates, archive limits, embedded executable payloads, and unresolved provider sources in focused unit fixtures.
- [ ] Wait for `m9.modpack-deployment.v1` publication before adding a remote API service; do not ship against the proposal identifier.
- [ ] Consume only published M1 session, M4 server, M5 compatibility/worker, and M9 API contracts.
- [ ] Upload the original archive only through the signed URL and treat the server validation report as authoritative.
- [ ] Display config/data, provider sources, rejected items, compatibility, and preview before enabling apply.
- [ ] Preserve and display the previous successful deployment when apply fails; expose rollback only when a valid snapshot is reported.
- [ ] Never execute archive content, deploy an embedded jar, resolve an arbitrary URL, call worker-internal routes, or store provider/worker secrets.
- [ ] Add stable test IDs, scratch Playwright coverage, renderer build, Electron compile, screenshots, and PR evidence for the first visible UI increment.