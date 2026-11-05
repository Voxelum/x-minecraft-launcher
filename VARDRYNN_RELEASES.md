# Vardrynn releases and updates (phase 5)

Updates come only from the Vardrynn service and are accepted only when an Ed25519 signature made by Vardrynn's release key verifies. There is no GitHub, npm-mirror or XMCL fallback.

## Trust model

| Step | Check |
| --- | --- |
| Discovery | `GET /v1/releases/latest` on the compiled-in origin (no redirects, 10 s timeout). Only an asset for this OS and architecture whose signature verifies is offered. |
| Signature | Ed25519 over `vardrynn-release-v1\n<version>\n<platform>\n<arch>\n<sha256>`. Binding the version, platform and architecture stops a signed file being replayed as another release or target. |
| Download | URL must be `https` and not an upstream host. The whole file is hashed while it streams to a `.partial` file; a mismatch deletes it. |
| Install | Stored update info is re-verified (it lives in a writable settings file), the staged file is hashed again, then the OS opens the package and the launcher quits. A failed open does not quit. Any failure returns the status to `pending`, so the download can be retried. |

These releases use the `verified` update operation. `manual` keeps its existing meaning in the UI: the launcher cannot update itself and the user must redownload. Download and install failures are shown in the update dialog.

The public key is compiled in as `VARDRYNN_RELEASE_PUBLIC_KEY` (base64, raw 32 bytes). Without it, or without `VARDRYNN_API_BASE_URL`, the updater reports `not-configured` and every step refuses. Settings update info with no Vardrynn signature (for example from an imported XMCL profile) is discarded.

## Producing a release

```sh
pnpm tsx scripts/vardrynn-release.ts keygen          # once; prints both keys
pnpm tsx scripts/vardrynn-release.ts manifest --version <x.y.z> --channel stable --dir <packages> \
  --download-base https://<host>/<x.y.z> --notes-url https://<url> --out release.json
```

Store `VARDRYNN_RELEASE_SIGNING_KEY` as a CI secret and the public key, API origin, download base and notes URL as repository variables (`VARDRYNN_RELEASE_PUBLIC_KEY`, `VARDRYNN_API_BASE_URL`, `VARDRYNN_RELEASE_DOWNLOAD_BASE`, `VARDRYNN_RELEASE_NOTES_URL`). Signing refuses a key that does not match the embedded public key. The `release` job in `.github/workflows/build.yml` runs this on `chore(release)` commits and uploads `release.json`, `SHA256SUMS` and the packages as the `vardrynn-release` workflow artifact. It publishes nothing.

Only `.dmg` (macOS) and `.deb` (Linux) are offered as updates. Windows is excluded until packages carry an Authenticode signature the OS will accept.

## Removed upstream release paths

Deleted workflows: `deploy-release.yml` (Azure AppInstaller, `xmcl-page`, `@xmcl/app-*` npm packages, Homebrew tap, Discord/KOOK), `core-release.yml` (npm publishing of `@xmcl/*`) and `core-github-pages.yml` (`xmcl-page`). In `build.yml`: the Voxelum release action, tag push to `voxelum/x-minecraft-launcher`, `xmcl-page` changelog push, DeepSeek release notes, Azure source-map upload, SignPath publisher and the `ci010` reviewer.

## Not done

- Hosting: nothing serves `/v1/releases/latest` (the Worker returns 404) or the package files. Choose storage (for example R2) and add the route.
- A production key pair has not been generated; the key custody decision is open.
- Not exercised: the CI job, a packaged and code-signed build, Linux, Windows, and an upgrade that actually replaces the app.
- Install is a hand-off to the OS opener; it is not silent. On macOS it mounts the dmg and quits, and the user still drags the app into Applications.
- The launcher's user agent is still `voxelum/x_minecraft_launcher/<version> (xmcl.app)` (`xmcl-runtime/app/LauncherApp.ts`), including on Vardrynn service and release requests. It goes to every provider, so changing it belongs with phase 9.
- `xmcl-asar/README.md` still describes the deleted `deploy-release.yml`.
- Windows updates, `appinstaller-builder.ts` (still disabled), `sign-release.yml` (upstream SignPath project, still present), `deploy-ui.yml`, the Windows `deskgap-app` build steps (pull Voxelum/DeskGap, pinned by its tests), and the disabled `build-arch` job (xmcl names) belong to Windows signing and phase 9.
- No rollback mechanism beyond installing an older signed package manually; the updater never downgrades.

## Verification on 2026-11-04

Real production bundle (`http://xmcl.runtime`, no dev server) on macOS arm64 with an isolated profile, a throwaway key, and a local TLS stub of the release route serving a real 17 KB dmg signed by `scripts/vardrynn-release.ts`. Driven through Settings > About over DevTools.

| Workflow | Observed |
| --- | --- |
| Startup discovery | One `GET /v1/releases/latest`; UI showed `v0.73.1 -> 99.0.0` |
| Tampered download | Rejected; dialog showed the checksum error; nothing staged |
| Forged signature; 99.0.1 manifest reusing the 99.0.0 signature | `No signed Vardrynn release for darwin-arm64`; no download |
| Redirect | Refused after one request |
| 404, 503 | Quiet no-op; `Vardrynn release service responded 503` |
| Staged file swapped after download | Install refused, file deleted, no mount, app stayed open, status back to pending |
| Retry, then install | Staged hash matched the package, the OS mounted the volume with the expected payload, and the launcher exited gracefully |
| Network audit | Passed across 122 bundle artifacts, 5,445 Chromium events and the Undici log |

This run found three defects the unit tests missed, all fixed: the dialog treated the release as `manual` and offered no download; failures reached only the log; and a failed install left a `ready` status with no way to download again. The dialog's XMCL website and Voxelum release links were also removed. Test volume, stub, profile, keys and bundle were removed afterwards.
