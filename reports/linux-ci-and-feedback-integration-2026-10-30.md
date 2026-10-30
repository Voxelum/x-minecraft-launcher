# Linux CI and feedback integration follow-up — 2026-10-30

## New human authorization
Admin explicitly requested a minimal PR fixing persistent Linux CI, and allowed own-author PRs (CI repair and1817) to merge without independent approval **only after new-head CI shows no regression**. Approval-only `--admin` is authorized if needed; no CI bypass, protection change or production release. Prior nightly report reflects the earlier authorization and is historical, not a current prohibition. This pass does not expand to1820 or safety-blocked1815/1794.

## CI repair PR1822 — MERGED
https://github.com/Voxelum/x-minecraft-launcher/pull/1822

- Exact tested head: `8ff38ee75ff0ec4c23b8d629e93e3ea1819d38a2`.
- Merge SHA: `aeb075b2b3cc72b57973f730cf736d325158e135`.
- Root cause persisted across many unrelated heads: recorder installation failed before application tests because ubuntu-latest moved toUbuntu26.04, absent from lockedPlaywright1.59.1 FFmpeg registry.
- Upstream support evidence: https://raw.githubusercontent.com/microsoft/playwright/v1.59.1/packages/playwright-core/src/server/registry/index.ts , FFmpeg table explicitly hasubuntu24.04-x64 and no26.04. e2e/pnpm-lock.yaml pinsPlaywright1.59.1. GitHub API source read encountered organization SAML403; public pinned raw source succeeded, no credential/access controls modified.
- Minimal diff: `.github/workflows/e2e.yml` only,4ubuntu-latest references replaced withubuntu-24.04: safety-net matrix; packaged_os manual choice; packaged-boot default matrix; showcase matrix. macOS/Windows unchanged. No FFmpeg/test skips/dependency updates.
- Upgrade strategy in workflow comment: advance pin only when lockedPlaywright supports target image and recorder plus actual safety-net pass. Manual packaged/showcase entry points remain manual and were not claimed executed.

### New-head checks
- Required Validate SUCCESS: https://github.com/Voxelum/x-minecraft-launcher/actions/runs/41010111504/job/123913848157
- Actual Linux safety-net SUCCESS: https://github.com/Voxelum/x-minecraft-launcher/actions/runs/41010111518/job/123913848530
- Windows SUCCESS: https://github.com/Voxelum/x-minecraft-launcher/actions/runs/41010111518/job/123913848545
- macOS SUCCESS: https://github.com/Voxelum/x-minecraft-launcher/actions/runs/41010111518/job/123913848235
- Linux log confirmsUbuntu24.04 image20261025.353.1, FFmpeg1011 download, renderer/main builds, actual safety-net **1test passed**. Not merely an installation smoke.
- Normal exact-head merge refused on approval policy; rechecked REVIEW_REQUIRED and all checks success, then executed one explicitly authorized `--admin --squash --match-head-commit` merge. No self-review/protection edits or CI bypass.

## Feedback PR1817 — integration candidate
https://github.com/Voxelum/x-minecraft-launcher/pull/1817

Normal safegit merge of latestmasteraeb075b2 into feedback branch produced `88f8b5f5` without text conflicts; all original feedback fixes/report and master changes retained. Read-only independent semantic analysis checked cancellation/preflight, target-runtimeJava, translation lazytelemetry import, both search implementations, blueprint sourceVersion/API/layout, Sponge validation, symlink convenience vs screenshot confinement, latesti18n/compiler/lock. No confirmed extra integration defect found; lack of overlapping paths is not substituted for tests.

### Local integration validation
- Frozen install SUCCESS.
- Explicit53-file integration manifest: **434tests passed**. Covers original feedback paths plus cancellation/telemetry/import, newmarket/Java/screenshots/i18n and package/Packwiz/network regressions. Manifest preserved alongside this report.
- Additional `i18n-core.test.mjs`: **16tests passed** under Vitest.
- `pnpm check` SUCCESS; `pnpm lint` SUCCESS (2existing runtimewarnings,0errors).
- Initial extra i18n-core invocation mistakenly used `node --test` on a Vitest test and failed runner initialization, not an app assertion; corrected Vitest invocation passed. This failure is recorded, not silently counted as success.
- Historical98test handoff manifest was unavailable; the current explicit450-test result is fresh, broader evidence, not a claim that an undocumented historical command was reproduced verbatim.
- Real isolated development-app workflow and final exact-head Linux/macOS/Windows/Core CI remain pending at this report revision. No merge is claimed yet; any true failure must be investigated before approval bypass.
