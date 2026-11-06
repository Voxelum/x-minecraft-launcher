# Vardrynn network destinations (phase 1)

The launcher remains a fork of XMCL. This inventory distinguishes required external providers from upstream launcher services. The shared guard in `xmcl-runtime/network/upstreamNetworkPolicy.ts` denies upstream hosts before Electron main fetches, Chromium requests (including redirects and WebSocket handshakes), and runtime downloads. The Undici guard sits inside redirect handling and also covers Electron's fallback fetch transport. Host checks normalize trailing dots and encoded repository/package paths; dispatch checks preserve the original host for paths starting with `//`. This is an interim safety boundary, not a release audit of every dependency and platform helper.

| Destination | Purpose | Phase 1 behavior |
| --- | --- | --- |
| `*.xmcl.app`, `xmcl-core-api.azurewebsites.net`, `xmcl.blob.core.windows.net` | XMCL API, flags, news, signaling, Agent, release metadata and packages | Denied; startup flags and launcher news fetches removed; updates disabled |
| `github.com/Voxelum/*`, `api.github.com/repos/voxelum/*`, `raw.githubusercontent.com/Voxelum/*` | Upstream releases, databases, static Java index and contributors | Denied in launcher fetch; bundled Zulu index used; contributor fetch removed; databases are copied by CI and served by the Vardrynn service |
| `registry.npmmirror.com/@xmcl/app-*` | Upstream package fallback | Update implementation removed |
| Azure Application Insights ingestion | XMCL telemetry | Exporters and connection strings removed; traces remain local |
| `launchercontent.mojang.com`, Minecraft/Microsoft endpoints | Minecraft news, authentication, game metadata | Still used for their respective features |
| Modrinth, CurseForge, Fabric, Forge and other content providers | Mod and game content | Still used when requested by the feature; CurseForge API calls go through the Vardrynn service's `/v1/curseforge/` proxy, which holds the API key, and CurseForge files download from its CDN directly |
| `http://launcher/agent/chat/completions` | Local Agent transport, intercepted before network dispatch | Rewritten to the configured custom provider; final destination still checked |
| `api.olaveapi.com`, `dev-api.olaveapi.com` | Vardrynn production and development services (`/v1/status`) | Only contacted by builds compiled with that origin |
| User-configured Agent endpoint | Custom AI provider | Still available when configured; builtin XMCL mode stays unavailable |

The XMCL account panel is hidden pending Vardrynn accounts. Multiplayer (phase 7) signals through `api.olaveapi.com` rooms and ICE servers (STUN and, when configured, Cloudflare Realtime TURN on Vardrynn's account); it needs a signed-in Vardrynn account and uploads no multiplayer telemetry. The manual-invite dialogs show only the connection token; the `xmcl.app/peer` link builders were removed in phase 9. The Agent's unavailable state offers custom-provider settings without an XMCL subscription action. Existing XMCL account state is not migrated by this phase. Help and feedback links point to the Vardrynn repository's issue tracker (`xmcl-runtime-api/src/util/vardrynnLinks.ts`). The only upstream links left are attribution: "Built on XMCL" and text links to the upstream author's sponsor pages on the About page (no remote images), and the README credits. The Ely.by authlib list is the bundled snapshot (no refresh service), and the mod-metadata and project-mapping databases come from the Vardrynn service's `/v1/databases` route, filled by the `mirror-databases` workflow (see `VARDRYNN_SERVICE_API.md`); a build without a service origin requests neither. The user agent is `vardrynn/launcher/<version> (<repository URL>)`. DeskGap's updater has no feed and reports `not-configured`; its EXE is a separate `deskgap-preview` CI artifact, kept out of release output, and must not be published until it has its own feed, signing and a release review. The upstream DeskGap runtime is a pinned, checksummed CI build input, not a runtime destination. Marketplace provider search remains functional.

## Repeatable checks

Build the renderer and production main bundle, then audit the JavaScript/HTML artifacts:

```sh
pnpm build:renderer
NODE_ENV=production pnpm --prefix=xmcl-electron-app compile
pnpm exec tsx scripts/check-vardrynn-network.ts \
  --bundle xmcl-electron-app/dist \
  --bundle xmcl-keystone-ui/dist
```

The static check rejects restored update-download, flags/news, and Azure telemetry destinations. It deliberately permits attribution links and generic service origins retained behind disabled code and the runtime guard. It cannot prove that a dynamically composed URL is inactive.

For a traffic audit, launch this repository's Electron process with `--log-net-log=<unique-path.json>`, exercise the workflow, and exit it to finish the capture. Then add `--net-log <unique-path.json>` and `--undici-log <profile>/logs/undici.log` to the audit command. Chromium's historical HTTP server preferences are excluded; actual request and DNS events are inspected. Undici's `client:sendHeaders` records are inspected separately because Chromium does not capture Node downloads. Keep raw captures local; they can contain private session data. Runtime download tests also verify direct and redirected denials without contacting upstream hosts.

After a production compile, restart `dev:main` and confirm `/json/list` reports `localhost:3000` before returning to development validation. Compilation overwrites the same main bundle.

## Verification on 2026-11-04

- Real development app: startup, My Stuff, Settings/About, unavailable Agent and multiplayer states, marketplace browsing and `Sodium` search, and opening/cancelling Create Game. Checked the unavailable view at `1200x720` and `800x400`; no horizontal overflow at minimum size.
- Custom Agent: configured a unique loopback test provider and temporary test key, sent a message through the actual Agent dialog, and received the provider's streamed confirmation. The provider observed the expected model and authorization; the renderer's local transport returned HTTP 200.
- Development capture: 77 observed renderer requests and 123,278 Chromium network events; no upstream XMCL traffic. The separate Undici log contained two sent request headers and no upstream destination.
- Isolated production bundle: loaded `http://xmcl.runtime/index.html`; persisted `builtinAgent=true`, an XMCL API override, telemetry opt-in, and auto-update opt-ins did not enable upstream services. Runtime flags were `{}`, update metadata was null, status was `none`, and update capability was `not-configured`. The audit passed across 232 build artifacts, 4,364 Chromium events, and two Undici requests.
- Cleanup: removed the temporary provider/key and test conversation, restored empty Agent endpoint/model settings, and removed the isolated production profile/game directory. No Minecraft instance or game-account fields were edited. The normal development app was rebuilt and restarted to verify the cleaned real profile.
- Regression coverage includes cached update rejection, persisted update opt-ins, local flags, session cancellation, direct/redirected downloads (including `//` paths), and the registered local Agent route. `pnpm check`, `pnpm lint`, the renderer build, and production main compilation passed. The full suite still has an unrelated timeout in `InstanceInstallService.progressive.test.ts` for watched pending counts after removing/recreating the staging root; isolated retry reproduces it. That file was not changed.

Signed installers, additional operating systems, real game installation/launch, fresh interactive OAuth sign-in, migration, and owned release infrastructure remain later-phase validation. The current profile had no installed instances or Minecraft versions, so no game was launched in this check.
