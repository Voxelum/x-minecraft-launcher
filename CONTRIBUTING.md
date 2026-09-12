
### Tech Stack & Some Background

<kbd>[<img title="Ukraine" alt="Ukraine" src="https://upload.wikimedia.org/wikipedia/commons/thumb/4/49/Flag_of_Ukraine.svg/1280px-Flag_of_Ukraine.svg.png" width="22">](i18n/CONTRIBUTING.ua.md)</kbd>
<kbd>[<img title="Russia" alt="Russia" src="https://upload.wikimedia.org/wikipedia/commons/thumb/f/f3/Flag_of_Russia.svg/1280px-Flag_of_Russia.svg.png" width="22">](i18n/CONTRIBUTING.ru.md)</kbd>
<kbd>[<img title="Poland" alt="Poland" src="https://upload.wikimedia.org/wikipedia/commons/thumb/1/12/Flag_of_Poland.svg/1280px-Flag_of_Poland.svg.png" width="22">](i18n/CONTRIBUTING.pl.md)</kbd>
<kbd>[<img title="Germany" alt="Germany" src="https://upload.wikimedia.org/wikipedia/commons/thumb/b/ba/Flag_of_Germany.svg/1280px-Flag_of_Germany.svg.png" width="22">](i18n/CONTRIBUTING.de.md)</kbd>
<kbd>[<img title="Korean" alt="Korean" src="https://upload.wikimedia.org/wikipedia/commons/thumb/0/09/Flag_of_South_Korea.svg/1280px-Flag_of_South_Korea.svg.png" width="22">](i18n/CONTRIBUTING.ko.md)</kbd>


Here we have a overview of the toolchain & runtime of this project

For the whole project, we have

- [Node.js >=18.17.0](https://nodejs.org/). The core libraries base environment.
- [Electron 27](https://electron.atom.io). The actual runtime of the launcher.
- [pnpm](https://pnpm.io/). Used for monorepo package management.
- [TypeScript](https://www.typescriptlang.org/). The whole project uses as much TypeScript as possible.

For main process (Electron), we have

- [esbuild](https://esbuild.github.io/). We use esbuild to build our main process TypeScript.

For renderer side, which is the pure front-end

- [Vue](https://vuejs.org). Used to build user interfaces.
- [Vite](https://vitejs.dev/). Used as our build system.
- [Vuetify](https://vuetifyjs.com/). Used as a component library.
- [Windi CSS](https://windicss.org/). Used for CSS tooling.
- [Vue Composition API](https://github.com/vuejs/composition-api). The bridge for compositional API for Vue 2. Once the Vuetify upgrade to the Vue 3, the Vue will be upgraded and this will be removed.

### Project structure

![diagram](/assets/diagram.svg)

- xmcl
  - The linked git repo [launcher-core](https://github.com/voxelum/minecraft-launcher-core-node) is a git submodule in this project.
  - Implements the core Minecraft install & launch logic, and expose them as a library.
- xmcl-electron-app
  - Use Electron to implement the runtime.
  - This directly depends on the xmcl-runtime.
  - This implicitly depends on xmcl-keystone-ui (temporally, might be removed later?)
- xmcl-keystone-ui
  - The major default UI of the launcher.
  - 100% browser compatible. No Electron API involved in this project.
- xmcl-runtime
  - The core implementation of the launcher architecture. This only depends on Node.js, and does not require Electron runtime.
- xmcl-runtime-api
  - This is the shared code & API for XMCL runtime. It can be used for renderer app (browser side)


### Concept/Structure

The launcher is composed by "server/client" or "main/renderer". They communicates with each other by Electron's [ipcMain](https://electronjs.org/docs/api/ipc-main) and [ipcRenderer](https://electronjs.org/docs/api/ipc-renderer).

The main is the "backend" of the launcher. It manages the windows, and all the persistent data/state of the app. It manages the state by [Vuex](https://vuex.vuejs.org/). Once the state/data has been modified by a [Vuex commit](https://vuex.vuejs.org/guide/mutations.html), it will broadcast a ipc message containing the [mutation info]((https://vuex.vuejs.org/guide/mutations.html)) the all the renderer. At the same time, it will trigger the save action of the modified module to write the change on disk.

The renderer is/are just (a) browsers which communicate with main. It maintains a copy of the store. (I can be a full copy, or a partial copy) User's input will trigger an [action](https://vuex.vuejs.org/guide/actions.html) or [commit](https://vuex.vuejs.org/guide/mutations.html), and it will be sync to the main. Though, it does't require any extra action for developer. The local commit and action will automatically send to main. The developer can treat the renderer as a normal vue application.

### Recommended Read Code Instruction

If you are interested in a specific page logic, you can go to `xmcl-keystone-ui/src/windows/main/views`. The `.vue` files under this folder are the major component used in the launcher. The prefix of the file are the domain of the UI.

See some examples:

1. `AppSideBar.vue` is the sidebar component, and the `AppSideBarInstanceItem.vue` is the component used in `AppSideBar.vue` representing an instance.
2. `Curseforge.vue` is the CurseForge page component, and the `CurseforgeCategories.vue` is the category card used in `Curseforge.vue` page.

If you are interested in core logic, you can goto `xmcl-runtime/services/`. Each file under it are representing a service for a specific domain/aspect of the launcher logic. During this process, you should also aware about the corresponding files under the `xmcl-runtime-api/services/`, which declare the interface of the actual services.

Some examples:

1. `xmcl-runtime/services/InstanceService.ts` contains the API implementation of add/remove/update of instances. The `xmcl-runtime-api/services/InstanceService.ts` contains the interface of the `InstanceService`
2. `xmcl-runtime/services/InstanceVersionService.ts` contains the API implementation of checking instance version health. It will determine what version will the instance use, and whether should we install that version.
3. `xmcl-runtime/services/InstallService.ts` contains the API implementation of install Minecraft/Forge/Fabric and etc.
3. `xmcl-runtime/services/LaunchService.ts` contains the API implementation of launch an instance.

## Contribute

Highly recommend to use the VSCode to open the project.

### Getting Started

#### Clone

Clone the project with submodule flag `--recurse-submodules`.

```bash
git clone --recurse-submodules https://github.com/Voxelum/x-minecraft-launcher
```

If you forget to add `--recurse-submodules` flag, you need to initialize & update the git submodule manually.

```bash
git submodule init
git submodule update
```

#### Install

Install the project using [pnpm](https://pnpm.io):

```
pnpm install
```

> **End-to-end tests are opt-in.** The `e2e/` package is intentionally
> outside the pnpm workspace, so `pnpm install` does not download Playwright
> for the 95% of contributors who never run e2e. If you want to run them,
> install once with `pnpm e2e:install` (no Chromium download is needed —
> the suite drives Electron directly). See `e2e/README.md` for details.

<details>
  <summary> 解决中国国内安装依赖（如 Electron）太慢的办法 </summary>

  打开你的 git bash，在 `pnpm i` 前面加上 `registry=https://registry.npm.taobao.org electron_mirror="https://npm.taobao.org/mirrors/electron/"`。使用国内阿里提供的 npm 以及 Electron 的镜像。

  最终输入的 command 也就是

  ```bash
  registry=https://registry.npm.taobao.org electron_mirror="https://npm.taobao.org/mirrors/electron/" pnpm i
  ```
</details>

#### Set Environment Variables

You should set the `CURSEFORGE_API_KEY` by creating a `.env` file under `xmcl-electron-app`. This `.env` file is added in `.gitignore` file.

**DO NOT LEAK YOUR CURSEFORGE API KEY**

#### Start Launcher

Then you can run the launcher

#### For VSCode

Go `Run and Debug` section, use the profile `Electron: Main (launch)` to start the electron. (Hot key F5)

#### For non VSCode

Open one terminal

```bash
# Start a dev server for UI
npm run dev:renderer
```

Open another terminal

``` bash
# Start watching main process code
npm run dev:main
```

#### Code "Hot" Change

You have code change, and you want to update the change to the running launcher instance.

##### For Browser process

The Vite provide hot reload, it should update automatically. If something went wrong, you can refresh the browser by `Ctrl+R`.

##### For Main process

If you use VSCode to launch the launcher, after you changed the code, you can press the reload button on VSCode debugger.

If you don't use VSCode to launch, it should close Electron and reload automatically.

### DeskGap Windows EXE in the regular release

The normal `.github/workflows/build.yml` builds Electron and an additional
`xmcl-deskgap-<version>-win32-x64.exe` in the **same `v<version>` draft release**.
DeskGap ships a single Windows x64 executable. There is no separate DeskGap tag,
update manifest, signing key, or published application-only archive.

**Current status: UNSIGNED PREVIEW, manual installation only.** Download and
run the DeskGap EXE manually; Windows may warn because it is not signed.
Production DeskGap signing and automatic updates are not enabled. The launcher
still checks signatures and will reject unsigned preview EXEs as automatic
updates; this is intentional, not a reason to disable verification.

The pinned runtime version is `config.deskgapVersion` in
`deskgap-app/package.json`. Windows CI obtains the runtime ZIP and `SHA256SUMS`
from `Voxelum/DeskGap` release `v<runtime-version>` and the packaging helpers from
that same tag. Missing releases or mismatched checksums fail the build; a local,
uncommitted runtime build is not a substitute for this release dependency.

The runtime must provide `windowsExecutable.verifySignature` and `install`,
Windows Authenticode verification against the expected full publisher subject,
and a bootstrap that can load an Authenticode-signed click-to-run EXE. It must also
support `--deskgap-wait-for-pid=<pid>` before installation/activation, strip that
argument before launching XMCL, and preserve the newest valid installed bundle
when the original EXE is opened again.

For local unsigned packaging, install the workspace dependencies and the matching
runtime source's packaging dependencies, then run with Node.js 24:

```powershell
pnpm build:renderer
$runtimeVersion = (Get-Content deskgap-app\package.json -Raw | ConvertFrom-Json).config.deskgapVersion
pnpm --prefix=deskgap-app package C:\path\to\pinned-DeskGap C:\extracted\DeskGap "C:\extracted\DeskGapBootstrap-v$runtimeVersion-win32-x64.exe"
pnpm exec vitest run deskgap-app\packaging.test.ts
```

`package` builds a production host and stages `deskgap-app/build/output/app`
with identity `xmcl-deskgap` / **XMCL DeskGap**, root workspace version,
`dist/main.cjs`, and the bundled renderer/native assets. The compressed application
payload is internal to the EXE, not a separate release asset. Source maps and
development files are excluded. Output is
`deskgap-app/build/output/release/xmcl-deskgap-<version>-win32-x64.exe`.

The runtime is copied into `deskgap-app/build/output/runtime-staging`, excluding
its default `resources/app` demo and local `DeskGap.exe.WebView2` browser data.
Bundling mutable browser data can invalidate installed runtime integrity checks
and cause an older click-to-run executable to roll back a completed update.
The supplied runtime directory is never modified. The ZIP's
`DeskGapBootstrap-v<runtime-version>-win32-x64.exe` is at its root, alongside the
`DeskGap` directory, not inside that directory. The same raw bootstrap is also
available as a separate asset in the runtime release.
**Do not use `DeskGap-<runtime-version>-win32-x64.exe`**: that is the runtime's
already-packaged default-app click-to-run executable, which XMCL packaging rejects.

The existing `.github/workflows/sign-release.yml` continues to sign only the APPX,
hash its final signed bytes, upload it and publish the regular release. It does
not download, sign, verify or replace the DeskGap preview EXE. An unsigned or
absent DeskGap EXE and the lack of a SignPath `deskgap-exe` configuration do not
block the APPX signing path, including older APPX-only drafts.

DeskGap signing is a comment-only placeholder in that workflow.
`.github/signpath/deskgap-exe.xml` and
`.github/scripts/verify-deskgap-signature.ps1` are retained for future activation,
not invoked by the current release workflow. When signing is enabled, an
administrator must register `deskgap-exe` in the existing SignPath project
`x-minecraft-launcher`, policy `release-signing`, and approve workflow access.
The existing `CODE_SIGN_TOKEN` is reused; no new private key is needed.
The returned EXE must have a valid signature with the full subject
`CN=SignPath Foundation, O=SignPath Foundation, L=Lewes, S=Delaware, C=US`;
only then may its final signed bytes be hashed and uploaded. Never rebuild,
append a payload, or otherwise modify the EXE after signing.

The update adapter selects Windows DeskGap EXEs from normal releases, respecting
the prerelease preference and version ordering. Download progress, cancellation
and retries use the normal XMCL downloader. SHA-256 and HTTPS do not replace
publisher verification: downloads become ready only after native Authenticode
verification. Installation copies to a private staging location and rechecks the
recorded SHA-256 and publisher before spawning the wait-for-PID installer; XMCL
then flushes and quits without relaunching the old runtime.

Before enabling production DeskGap signing/automatic updates, validate a real
SignPath-signed EXE, including old-EXE reopen, tamper/wrong-publisher rejection and
wait-for-PID handoff. That work is explicitly deferred for the unsigned preview;
shipping it does not establish a working production signed-update workflow.

The retained local `0.69.0` smoke EXE with SHA-256
`adc11b0be2b572951ed6d17d47c62c5351d65eb412c72d3c79cfe453e1cb7024`
is a **legacy sample, not a release candidate**. It uses a disposable test public
key and an older runtime predating the entry-containment and Authenticode changes.
Its private key was discarded. Do not sign or distribute this sample as the new
release; rebuild from the published pinned runtime using the flow above.

This is not a complete cross-platform parity claim. Linux and non-x64 installers
have not been exercised by this release path. The current macOS WKWebView runtime
does not provide the persistent/named sessions and per-session proxy support used
by this host (`persist:main` and `xmcl-network`); those runtime APIs must be
implemented before enabling a macOS release job.

Another known host gap is direct upstream OptiFine downloading: disabling the
BMCLAPI mirror in Network Settings and requesting an OptiFine installation
produces `OptifineNoMirrorError`. The DeskGap host currently supports the mirror
route only; its update/release support does not imply that this gap is resolved.

### Found something wrong in launcher core

The launcher core is in [separated project](https://github.com/voxelum/minecraft-launcher-core-node) written in TypeScript.

Please open issue there if you identify any issue related to it.

#### Recommended way to interact with Vuex

- Create a new file for hook in `src/renderer/composables` folder, and export the hook throw `src/renderer/composables/index.ts`
  - Wrap Vuex operation in your hook
- Import your hook by `import { yourHook } from '/@/composables'` in your Vue file
- Use hook in Vue file without directly access of Vuex

### VSCode debugger

The project includes VSCode debugger configs. You can add breakpoint on line and debug. Currently, VSCode debugger method only supports debug on main process.

(You can use Chrome Devtools for renderer process anyway)

We have two options now:

1. Electron: Main (launch)
2. Electron: Main (attach)

If you use the first one to launch, it will automatically attach the debugger to the instance.


### Commit your code

This project follow the [conventional commits](https://www.conventionalcommits.org/en/v1.0.0-beta.3/). In short, the first line of your commit message should be:

```
commit type: commit description
```

There are several avaiable commit type: `feat`, `fix`, `refactor`, `style`, `docs`, `chore`, `test`.

Refer from [this gist](https://gist.github.com/joshbuchea/6f47e86d2510bce28f8e7f42ae84c716):

> feat: (new feature for the user, not a new feature for build script)
>
> fix: (bug fix for the user, not a fix to a build script)
>
> docs: (changes to the documentation)
>
> style: (formatting, missing semi colons, etc; no production code change)
>
> refactor: (refactoring production code, eg. renaming a variable)
>
> test: (adding missing tests, refactoring tests; no production code change)
>
> chore: (updating grunt tasks etc; no production code change)

**Your commit will be rejected if you do not follow these rules.**

### How To Build

The current launcher require to run 2 commands to build

First, you need to build the frontend code:

```bash
pnpm build:renderer
```

Unless the code under `xmcl-keystone-ui` changed, you don't need to build this again.

Then, you can build Electron bundling with frontend you just build:

```bash
pnpm build:all
```

If you want a debug build, you can use `pnpm build:dir` which only build the directory result, and won't pack them up to different release format.
