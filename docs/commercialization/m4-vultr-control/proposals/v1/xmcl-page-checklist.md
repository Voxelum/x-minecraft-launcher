# xmcl-page implementation checklist

- [ ] Consume the shared-owner-published M4 schema once `xmcl-web-api/proposals/m4/` is promoted; until then use only its compatible fixtures.
- [ ] Reuse the site commercial API client and M1 session rather than creating another account or token store.
- [ ] Show Taipei and allowlisted plans only; do not imply multi-region or arbitrary image support.
- [ ] Label the product as XMCL hosted cloud servers, distinct from local dedicated-server controls.
- [ ] Decode server/task/usage responses and handle unknown contract values as recoverable errors.
- [ ] Require explicit confirmation for stop, restart, and delete; generate one idempotency key per user intent.
- [ ] Display queued, running, succeeded, failed, conflict, quota, permission, and billing-blocked states.
- [ ] Do not expose Vultr token, provider resource id, raw provider errors, worker credentials, or direct state mutation.
- [ ] Add component tests for fixture cases and browser tests for create/start/stop/failure flows after the page repository is in the active workspace.
- [ ] Capture responsive visual evidence using the page repository's own contributor contract.