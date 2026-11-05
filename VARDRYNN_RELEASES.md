# Vardrynn releases and updates (phase 5)

Updates come only from the Vardrynn service and are accepted only when an Ed25519 signature made by Vardrynn's release key verifies. There is no GitHub, npm-mirror or XMCL fallback.

## Trust model

| Step | Check |
| --- | --- |
| Discovery | `GET /v1/releases/latest` on the compiled-in origin (no redirects, 10 s timeout). Only an asset for this OS and architecture whose signature verifies is offered. |
| Signature | Ed25519 over `vardrynn-release-v1\n<version>\n<platform>\n<arch>\n<sha256>`. Binding the version, platform and architecture stops a signed file being replayed as another release or target. |
| Download | URL must be `https` and not an upstream host. The whole file is hashed while it streams to a `.partial` file; a mismatch deletes it. |
| Install | Stored update info is re-verified (it lives in a writable settings file) and the staged file is hashed again. Then it is installed in place (below), or, where that is not possible, the OS opens the package and the launcher quits. A failed install or open does not quit. Any failure returns the status to `pending`, so the download can be retried. |

### Installing in place

`xmcl-electron-app/main/utils/updateInstaller.ts`. Only packaged builds are replaced; a development Electron never is.

- **macOS:** a detached `/bin/sh` helper waits for the launcher to exit, mounts the verified dmg read-only, refuses an `.app` whose `CFBundleIdentifier` differs from the running one, copies it beside the current bundle, then swaps the two. Any failure puts the old bundle back. Either way it reopens the launcher. Its output goes to `<appData>/vardrynn/update-install.log`. A translocated, read-only or non-bundle install falls back to opening the dmg.
- **Linux:** `pkexec /usr/bin/dpkg -i <deb>` shows the system password prompt; on success the launcher relaunches into the new version. A dismissed prompt or a failed install leaves the old version running and reports the error. Without `pkexec`, or for a non-deb install, the package is opened instead.
- Staged packages that are not newer than the running version are deleted at the next update check.

These releases use the `verified` update operation. `manual` keeps its existing meaning in the UI: the launcher cannot update itself and the user must redownload. Download and install failures are shown in the update dialog.

The public key is compiled in as `VARDRYNN_RELEASE_PUBLIC_KEY` (base64, raw 32 bytes). Without it, or without `VARDRYNN_API_BASE_URL`, the updater reports `not-configured` and every step refuses. Settings update info with no Vardrynn signature (for example from an imported XMCL profile) is discarded.

## Producing a release

The `release` job in `.github/workflows/build.yml` signs and publishes:

| Trigger | Bucket | Builds check |
| --- | --- | --- |
| `chore(release)` commit on `master` | `vardrynn-releases-prod` | `VARDRYNN_API_BASE_URL` |
| Manual run with `publish: dev` | `vardrynn-releases-dev` | `VARDRYNN_DEV_API_BASE_URL` |

The job runs in the GitHub environment `release`, which requires the repository owner's approval before it starts. Its secrets are `VARDRYNN_RELEASE_SIGNING_KEY` and the publishing pairs `VARDRYNN_S3_{DEV,PROD}_{ACCESS_KEY_ID,SECRET_ACCESS_KEY}`. Repository variables: `VARDRYNN_RELEASE_PUBLIC_KEY`, `VARDRYNN_S3_ENDPOINT`, `VARDRYNN_S3_{DEV,PROD}_BUCKET`, `VARDRYNN_DEV_API_BASE_URL`, and optionally `VARDRYNN_RELEASE_NOTES_URL` (defaults to the commit page). Signing refuses a key that does not match the public key. The packages, `release.json` and `SHA256SUMS` are also kept as the `vardrynn-release` workflow artifact.

`VARDRYNN_API_BASE_URL` is deliberately unset (see `VARDRYNN_SERVICE_API.md`), so production builds report updates as `not-configured` until it is set to `https://api.olaveapi.com`.

**Key custody.** The production key pair was generated on 2026-11-05 in one process: the private half went straight into the `release` environment secret and was never written to disk or shown, so it cannot be recovered. Public key: `0mTr54fkHvFea8E+o+KDBZanknCmyrvH8QTFov6LQwQ=`. If the secret is lost or exposed, generate a new pair, replace the secret and variable, and ship a build with the new key through a channel users already trust; builds holding only the old key cannot verify releases signed by the new one.

By hand:

```sh
pnpm tsx scripts/vardrynn-release.ts keygen          # test keys only
pnpm tsx scripts/vardrynn-release.ts manifest --version <x.y.z> --channel stable --dir <packages> \
  --download-base https://s3.olaveapi.com/<bucket>/<x.y.z> --notes-url https://<url> --out <packages>/release.json
S3_ENDPOINT=https://s3.olaveapi.com S3_BUCKET=<bucket> AWS_ACCESS_KEY_ID=... AWS_SECRET_ACCESS_KEY=... \
  scripts/vardrynn-publish.sh <packages>
```

Only `.dmg` (macOS) and `.deb` (Linux) are offered as updates. Windows is excluded until packages carry an Authenticode signature the OS will accept.

## Serving a release

Releases live in the S3 buckets `vardrynn-releases-dev` and `vardrynn-releases-prod` at `https://s3.olaveapi.com` (credentials and layout: `LiveNetwork/minio/vardrynn/README.md`). The buckets are private, so the Worker reads them with the **read-only** pair and the launcher never holds credentials.

`GET /v1/releases/latest` fetches `latest.json` from the bucket with a 60 s presigned URL (no redirects). Every asset URL inside that bucket is replaced by a presigned GET URL (default 1 h, `DOWNLOAD_URL_TTL_SECONDS`, 60 s to 24 h). The release signature does not cover URLs, so the launcher's verification is unaffected; the download hash and signature still are. URLs outside the bucket pass through unchanged. The response is `no-store`. A missing object returns 404 (the launcher treats it as no release); any other storage failure or a manifest that is not `v1` returns 503.

Worker settings: `S3_ENDPOINT`, `S3_BUCKET`, `S3_REGION`, `S3_READ_ACCESS_KEY_ID`, `S3_READ_SECRET_ACCESS_KEY` (the last two as secrets). Use the dev bucket for the dev Worker and the prod bucket for production. The older R2 `RELEASES` binding still works when the S3 settings are absent.

`scripts/vardrynn-publish.sh` checks that every asset URL is under `<endpoint>/<bucket>/<version>/` and that each local package matches its signed hash. It refuses to overwrite a version that already exists unless `ALLOW_REPUBLISH=1` (CI sets it only for dev). It uploads the packages (multipart above 8 MB) and confirms their sizes, then `SHA256SUMS` and `<version>/release.json`. It copies the current `latest.json` to `previous.json` and uploads the new manifest as `latest.json` last, so a client never sees a manifest whose files are missing.

### Rolling back

The updater never downgrades. To stop a bad release reaching more users, restore the previous manifest; clients that already updated stay on it until a fixed, higher version ships:

```sh
aws --endpoint-url https://s3.olaveapi.com s3 cp s3://<bucket>/previous.json s3://<bucket>/latest.json
```

Any `<version>/release.json` can be restored the same way. On an individual Mac, a failed in-place swap restores the old bundle by itself.

## Removed upstream release paths

Deleted workflows: `deploy-release.yml` (Azure AppInstaller, `xmcl-page`, `@xmcl/app-*` npm packages, Homebrew tap, Discord/KOOK), `core-release.yml` (npm publishing of `@xmcl/*`) and `core-github-pages.yml` (`xmcl-page`). In `build.yml`: the Voxelum release action, tag push to `voxelum/x-minecraft-launcher`, `xmcl-page` changelog push, DeepSeek release notes, Azure source-map upload, SignPath publisher and the `ci010` reviewer.

## Not done

These need something this repository cannot supply on its own:

- **The CI job has not run.** This branch is not on GitHub yet (`origin/master` is still the upstream history), so the `release` job needs the work merged to `master`, then a `chore(release)` commit or a manual `publish: dev` run. Its publish script and every step it runs were exercised by hand (below).
- **No production release is published.** It waits on the first CI run, and on `VARDRYNN_API_BASE_URL` being set; until then, production builds cannot check for updates.
- **Code signing.** macOS builds are ad-hoc signed and not notarized, because there is no Apple Developer ID. They update in place (below), but a first install from a browser download meets Gatekeeper. Windows updates stay excluded until Authenticode signing exists.
- **Windows and x64.** Only arm64 was exercised on macOS and Linux. Windows has no update path.
- **Out of phase 5:** the user agent (`voxelum/x_minecraft_launcher/...` in `xmcl-runtime/app/LauncherApp.ts`) and the About page's XMCL and Afdian links (phase 9); `appinstaller-builder.ts`, `sign-release.yml`, `deploy-ui.yml`, the Windows `deskgap-app` steps and the disabled `build-arch` job (Windows signing and phase 9).

## Packaged upgrades on 2026-11-05

Two packaged builds per platform, 0.73.1 and 0.73.2, compiled against `https://dev-api.olaveapi.com` with a throwaway key. 0.73.2 was signed and uploaded to `vardrynn-releases-dev` with `scripts/vardrynn-publish.sh`, and 0.73.1 updated itself through Settings › About › update dialog, driven over DevTools. Each used an isolated app-data folder and data root.

| | macOS 26 arm64 (ad-hoc signed dmg) | Ubuntu 24.04 arm64 VM (deb) |
| --- | --- | --- |
| Discovery at startup | `v0.73.1 -> 0.73.2` | `v0.73.1 -> 0.73.2` |
| Download (presigned, hashed) | 133 MB in 26 s | 95 MB in 19 s |
| Install | Launcher exited in 1 s; helper swapped the bundle in about 5 s; no mounts or backup left | `pkexec /usr/bin/dpkg -i` (password prompt answered by a test-only polkit rule); dpkg at 0.73.2 in 6 s |
| Relaunch | Reopened by the helper; log: `core version is 0.73.2` | `app.relaunch()` with the same arguments; log: `core version is 0.73.2` |

The publish script also passed against the dev bucket: a 20 MB multipart upload, a dmg and a deb in one manifest, refusal of a tampered package, of an asset URL outside the bucket and of a second publish of the same version.

Defects found and fixed: every deb failed its post-install check because `postinstall.ts` still rewrote electron-builder's install path to `/opt/xmcl` (the scripts expect `/opt/Vardrynn`); the staged 133 MB package stayed in app data after a successful update; and `HeadObject` right after a multipart upload can briefly return 403, so the publish script retries it. Unit tests run the macOS swap helper against real dmgs made with `hdiutil`, including one whose bundle identifier differs (the old app is kept and reopened).

Isolation: the first-run screen of the macOS test briefly probed the default data root `~/.vardrynn` (its directory timestamp changed; no file in it did) before the test seeded its own root. The real `~/Library/Application Support/vardrynn` profile was not touched. The VM, test keys, packages, bucket objects and `launchctl` variable were removed afterwards; the dev route returns 404 again.

## Hosted route on 2026-11-05

`vardrynn-api-dev` was deployed from the committed `worker.js` with `S3_ENDPOINT`, `S3_BUCKET` and `S3_REGION` as plain bindings and the dev read-only pair as secrets. A throwaway release (4 KB `.dmg`, throwaway key) was uploaded to `vardrynn-releases-dev` with the publishing pair, package first.

| Check | Observed |
| --- | --- |
| `GET dev-api.olaveapi.com/v1/releases/latest` | 200, `no-store`; asset URL presigned for 3600 s |
| Launcher parsing | `parseVardrynnRelease` + `selectVerifiedAsset` accepted the served manifest for darwin-arm64 |
| Presigned download | 200, bytes identical; range request 206 |
| Tampered or missing URL signature | 403 |
| `latest.json` with `apiVersion: v2` | 503 |
| Objects removed | 404; bucket empty afterwards |

This found one defect the unit tests missed: Workers reject `fetch(..., { redirect: 'error' })`, so every storage read failed with 503. It now uses `redirect: 'manual'`, and a redirect counts as a failure. The packaged launcher did not download through this route; that is still open.

Production (`vardrynn-api`) was deployed from the same commit (`65eb1c5bf`) with the prod bucket's bindings and read-only secrets. The deployed source matched the committed file. With `vardrynn-releases-prod` empty, `/v1/releases/latest` returned 404 (`no-store`), which this code returns only when storage accepts the signed read; bad credentials would return 503. `/v1/status` returned 200, `/v1/config` 404 and `POST` 405. No test release was uploaded to production.

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
