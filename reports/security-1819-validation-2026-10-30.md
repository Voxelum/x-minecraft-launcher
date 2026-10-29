# PR1819 isolated validation (2026-10-30)

Original reported head83274e33ce9ec0759486401f2586621fa480f024 was superseded by Dependabot head `d4e28c20b8a52507c68b7d41fca901c965611dd8` (parent bdad8a4) by the time the independent clone fetched the branch. Latest master fb0376c39ad3fc37da728394bd24b2c9d5aece89 integrated once before publication. No rebase/force or workspace/compiler changes.

Independent clone `/Users/honx/Workspaces/xmcl-security-night-1819`, Node24.22.0 / pnpm11.10.0. Frozen install resolves actual undici7.30.1; lock importer specifier remains^7.29.0 due existing workspace override, correctly selecting7.30.1. No override modification.

## Automated evidence

- Frozen install/check/lint exit0 on bdad8a4 candidate; repeated after final master integration (retained local logs).
- Focused Vitest: NetworkAgent.integration.test.ts, FileTransferInstallDownloader.integration.test.ts and packages/file-transfer: **34passed, 1 live BMCL test skipped**. No public game download required.
- Added real loopback NetworkAgent/custom Pool test: normal body and user-agent,302 redirect,503 retry exactly twice,206 bytes2-5 response/content-range, slow-stream abort, kClients Map entry containing Pool, destroyClient cleanup/activity false, subsequent request recreates pool and cleans up again. Existing file-transfer tests cover range fallback/retry, cancellation and destination behavior.
- First new-test attempt omitted optional TLS constructor objects and failed in undici buildConnector; test corrected to mirror production caller supplying requestTls/proxyTls objects. No production behavior was changed to hide a failure.

## Actual development launcher

- Separate dev main watcher with HAS_DEV_SERVER=true, renderer localhost3000; isolated `.tmp/security-profile` appData/gameData; CDP9419. CLI daemon was not running when session started; unrelated Shadow Electron processes left untouched.
- Official chrome-devtools CLI verified X Minecraft Launcher, localhost3000/index.html#/me at1200x720. App booted, NetworkInterface initialized and Personal Center rendered; captured renderer console showed only revalidation log on inspection, no undici initialization exception. App main logs retained. This is startup/integration smoke, not a game-download workflow or comprehensive network audit.
- No real login, game install or game launch. App/main/renderer/CLI stopped, isolated profile removed. No user state changed.

## Limits / recommendation

Supports compatibility of the targeted update conditional on exact published-head CI/review. kClients is still an internal API and remains a future upgrade risk; tests check current Map shape rather than promising stability. Explicit destroyClient cleanup is tested, not every idle timer state. No TLS trust-policy claim: existing connector trust settings were not expanded or audited. No proxy-authentication/live CDN/Windows/macOS-packaged download matrix exercised here. No merge or CI bypass performed. Live-app evidence predates the final markdown-only master dependency integration.

Raw logs retained locally under reports/security-1819-evidence/ (not committed) and /tmp/security1819-*.log. Final remote CI needs reevaluation after publication.
