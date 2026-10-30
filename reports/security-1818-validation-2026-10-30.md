# PR1818 isolated validation (2026-10-30)

Original observed head: `9770884d4b40ea6b546001d953c0b0fb7090bcb7`. Dependabot concurrently refreshed its branch to `1782942360d45fbde7e1b88601689f12ffc73a6f`; ordinary merge incorporated that equivalent source tree. Latest master fb0376c39ad3fc37da728394bd24b2c9d5aece89 integrated once before publication. No rebase/force or workspace/compiler configuration edits.

Independent clone: `/Users/honx/Workspaces/xmcl-security-night-1818`. Local Node24.22.0 / pnpm11.10.0; Node24 meets workspace >=22.16 (not a Node20 compatibility claim).

## Automated evidence

- Frozen install, check and lint exit0 before final master integration and again on final fb0376c39-integrated tree.
- `pnpm build:renderer`: exit0 on both bdad8a4 and final fb0376c39-integrated candidate; bundle verifier reports 0 orphan initialization helpers across105 chunks.
- `pnpm exec vitest run xmcl-keystone-ui/src/i18n.integration.test.ts`: 2 tests passed. Covers build-side @intlify/message-compiler11.4.0 JIT AST consumed by vue-i18n11.4.14 runtime, named interpolation/plurals, English fallback, French switch, dynamically installed German messages, Translation VNode slots and escaped text interpolation.
- Initial test type-check found the inferred en/fr locale union excluded de; corrected declared test locale schema and reran check successfully.

## Actual development launcher

- Built with `LAUNCH_BY=vscode pnpm dev:main`, started `pnpm dev:renderer`; isolated Electron profile/gameData under this clone's `.tmp/security-profile`. CDP port9418. `/json/list` confirmed **X Minecraft Launcher**, `http://localhost:3000/index.html`, 1200x720.
- Official chrome-devtools CLI: Personal Center -> Settings, language combobox Chinese -> English -> French. Observed English General/Language and French Général/Langue UI. Runtime locale changed zh-CN -> en -> fr; availableLocales added fr; French YAML lazy request returned200.
- Restarted app with same isolated profile: locale fr persisted, Personal Center loaded, no instances created. No login, game install or game launch.
- Console inspection: missing UserContext injection warning and one resource404 observed; no i18n/compiler exception observed. Not a blanket clean-console claim or proof of baseline provenance.
- App, main watcher, renderer and CLI daemon stopped; temporary isolated profile removed. No user profile touched.

## Limits / recommendation

Narrow compatibility evidence supports upgrade, conditional on final-head required CI/review. This tests ordinary escaped rendering, **not all v-html sinks** or universal sanitization. Build compiler remains11.4.0 through existing unplugin chain; no global override added. No merge or CI bypass performed. Remote checks must be rechecked after publication; earlier Linux failure must not be represented as passing.

Local logs are retained under reports/security-1818-evidence/ (not committed) and /tmp/security1818-*.log. Final live-app evidence predates the markdown-only latest-master dependency integration.
