# Vardrynn local-data import

Implements phase 3 of `VARDRYNN_INDEPENDENCE_PLAN.md`.

## Design

Import is an explicit copy, offered during onboarding and in Settings / General.
Detect the sibling `xmcl` profile, or let the user choose another profile. Show
the source profile, original game-root pointer, destination, instances, account
reference count, file count and bytes before copying. Closing the preview writes
nothing. Tell users to close XMCL while copying.

Keep a versioned journal and copied game root under Vardrynn's profile. Copy only
known game directories, compatible settings, instance configuration and public
account references. Copy external instances into managed directories; rebase
internal symlinks to the copy and reject links outside the copied roots. Never
move, rename, delete, or write into XMCL. Retain the original game-root pointer
in the journal, but activate the independent copy to prevent shared writes.

Do not import Electron/browser storage, encrypted or plaintext credentials,
MSAL caches, launcher account sessions, protocol registrations, backups, feature
flags, update metadata, proxy credentials, Agent settings, launch hooks or launch
environment variables. Microsoft/offline account references are schema-filtered;
online references are expired and require sign-in. Other account systems require
adding again. Do not reuse `migrate.ts`, which moves the source.

Copy regular files atomically, preserving executable modes. Retry compares file
contents, so interrupted copies can resume without duplicating data. Cancel
stops between files and keeps an inactive resumable copy. Activation and rollback
are queued for restart and applied by `recoverRestore`, the gate every profile
reader awaits, only while holding the single-instance lock. Snapshot Vardrynn's
four affected profile files and the two `user.json` recovery sidecars at
activation; a durable journal lets an interrupted activation/rollback finish on
the next start, and a failed recovery is logged and retried rather than blocking
launch. Rollback restores that snapshot and keeps copied game files, including
subsequent user changes. A rolled-back import cannot be run again from the panel.

## Implementation plan

- [x] Add filesystem-backed import engine and regression tests for preview,
  source preservation, filtering, external instances, links, interruption,
  idempotence, activation recovery, and rollback.
- [x] Connect typed preload IPC, startup recovery, and a reusable import panel
  in onboarding and Settings. Run focused tests, `pnpm check`, and `pnpm lint`.
- [x] Exercise preview/cancel/import/restart/rollback in the real development
  app with disposable profiles at 1200x720 and 800x400. Confirm source hashes,
  loaded instances, account reauthentication, logs, and cleanup after restart.

## Execution notes

- Continue on the existing `codex/task-1-upstream-isolation` branch so the
  uncommitted phase 1/2 work and running development app remain available.
- The supplied phase plan is the specification. No service deployment, release,
  shared compiler configuration change, or source-profile import is authorized
  by the validation: use temporary fixture copies only.

## Verification on 2026-11-04

Automated, from the repository root: `npx vitest run` passed 2965 tests with 1
failure, the `InstanceInstallService.progressive` "whole staging root" watcher
test. That test times out intermittently, including when run alone (1 of 3 solo
runs passed), and does not touch import code. Type-checks and oxlint pass in
`xmcl-runtime-api`, `xmcl-runtime`, `xmcl-electron-app`, and `xmcl-keystone-ui`.

Real app, macOS, using an isolated instance (`XMCL_E2E_APP_DATA`, port 9333,
renderer from `localhost:3000`) and a disposable fixture of 403 game files with
planted secrets and an external instance:

- Settings: preview wrote nothing; close, cancel at 19 of 403 files, reopened
  panel, retry, activate and undo all behaved as designed across real restarts.
- Onboarding with an empty profile: import and activate skipped the wizard, and
  undo removed `root` and returned to it. Panel fits 1200x720 and emulated 800x400.
- All 408 source files kept their SHA-256 hashes after every step. No planted
  secret reached the profile. The account was expired and held no token.

The real run found two defects the engine tests had missed, both now covered by
regression tests: `InstanceService` lost the selection when renaming a directory
to its instance name, and rollback left `user.json.backup`, which restored the
imported account. The engine tests separately caught canonical-path failures on
macOS, where `/var` resolves to `/private/var`.

## Not verified

- A real XMCL profile or real-size data. Only fixtures were used, as authorized.
- Launching Minecraft from an imported instance. Fixture instances have no
  playable version, so "imported instances work" is only confirmed as far as
  loading and selection.
- XMCL and Vardrynn running side by side, and Windows or Linux behavior.
- Free disk space is not checked before copying; a full disk fails and retries.
- Only `en.yaml` has the panel strings; other locales fall back to English.
