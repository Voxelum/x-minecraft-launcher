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

## Serving a release

Releases live in the S3 buckets `vardrynn-releases-dev` and `vardrynn-releases-prod` at `https://s3.olaveapi.com` (credentials and layout: `LiveNetwork/minio/vardrynn/README.md`). The buckets are private, so the Worker reads them with the **read-only** pair and the launcher never holds credentials.

`GET /v1/releases/latest` fetches `latest.json` from the bucket with a 60 s presigned URL (no redirects). Every asset URL inside that bucket is replaced by a presigned GET URL (default 1 h, `DOWNLOAD_URL_TTL_SECONDS`, 60 s to 24 h). The release signature does not cover URLs, so the launcher's verification is unaffected; the download hash and signature still are. URLs outside the bucket pass through unchanged. The response is `no-store`. A missing object returns 404 (the launcher treats it as no release); any other storage failure or a manifest that is not `v1` returns 503.

Worker settings: `S3_ENDPOINT`, `S3_BUCKET`, `S3_REGION`, `S3_READ_ACCESS_KEY_ID`, `S3_READ_SECRET_ACCESS_KEY` (the last two as secrets). Use the dev bucket for the dev Worker and the prod bucket for production. The older R2 `RELEASES` binding still works when the S3 settings are absent.

Publishing: generate the manifest with `--download-base https://s3.olaveapi.com/<bucket>/<x.y.z>`, upload the packages with the publishing pair (multipart for large installers), and upload `release.json` last as `latest.json`, so a client never sees a manifest whose files are missing.

## Removed upstream release paths

Deleted workflows: `deploy-release.yml` (Azure AppInstaller, `xmcl-page`, `@xmcl/app-*` npm packages, Homebrew tap, Discord/KOOK), `core-release.yml` (npm publishing of `@xmcl/*`) and `core-github-pages.yml` (`xmcl-page`). In `build.yml`: the Voxelum release action, tag push to `voxelum/x-minecraft-launcher`, `xmcl-page` changelog push, DeepSeek release notes, Azure source-map upload, SignPath publisher and the `ci010` reviewer.

## Not done

- Hosting: both Workers serve their buckets. The CI `release` job does not upload to a bucket, and no real release has been published.
- A production key pair has not been generated; the key custody decision is open.
- Not exercised: the CI job, a packaged and code-signed build, Linux, Windows, and an upgrade that actually replaces the app.
- Install is a hand-off to the OS opener; it is not silent. On macOS it mounts the dmg and quits, and the user still drags the app into Applications.
- The launcher's user agent is still `voxelum/x_minecraft_launcher/<version> (xmcl.app)` (`xmcl-runtime/app/LauncherApp.ts`), including on Vardrynn service and release requests. It goes to every provider, so changing it belongs with phase 9.
- `xmcl-asar/README.md` still describes the deleted `deploy-release.yml`.
- Windows updates, `appinstaller-builder.ts` (still disabled), `sign-release.yml` (upstream SignPath project, still present), `deploy-ui.yml`, the Windows `deskgap-app` build steps (pull Voxelum/DeskGap, pinned by its tests), and the disabled `build-arch` job (xmcl names) belong to Windows signing and phase 9.
- No rollback mechanism beyond installing an older signed package manually; the updater never downgrades.

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
