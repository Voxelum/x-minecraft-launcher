
### Tech Stack & Some Background

Here we have a overview of the toolchain & runtime of this project

For the whole project, we have

- [nodejs 14](https://nodejs.org/). The core libraries base environment. Some build scripts are based on node 14.
- [electron 15](https://electron.atom.io). The actual runtime of the launcher.
- [pnpm](https://pnpm.io/). Used for monorepo package management.
- [typescript](https://www.typescriptlang.org/). The whole project uses as much typescript as possible.

For main process (electron), we have

- [esbuild](https://esbuild.github.io/). We use esbuild to build our main process typescript.

For renderer side, which is the pure front-end

- [vue](https://vuejs.org). Used to build user interfaces.
- [vite](https://vitejs.dev/). Used as our build system.
- [vuetify](https://vuetifyjs.com/). Used as a component library.
- [windicss](https://windicss.org/). Used for css tooling.
- [vue composition API](https://github.com/vuejs/composition-api). The bridge for compositional API for vue 2. Once the vuetify upgrade to the vue 3, the vue will be upgraded and this will be removed.

### Project structure

![diagram](/assets/diagram.svg)

- xmcl
  - The linked git repo [launcher-core](https://github.com/voxelum/minecraft-launcher-core-node) is a git submodule in this project.
  - Implements the core Minecraft install & launch logic, and expose them as a library.
- xmcl-electron-app
  - Use electron to implement the runtime.
  - This directly depends on the xmcl-runtime.
  - This implicitly depends on xmcl-keystone-ui (temporally, might be removed later?)
- xmcl-keystone-ui
  - The major default UI of the launcher.
  - 100% browser compatible. No electron API involved in this project.
- xmcl-runtime
  - The core implementation of the launcher architecture. This only depends on nodejs, and does not require electron runtime.
- xmcl-runtime-api
  - This is the shared code & API for xmcl runtime. It can be used for renderer app (browser side)

### Concept/Structure

The launcher is composed by "server/client" or "main/renderer". They communicates with each other by electron's [ipc main](https://electronjs.org/docs/api/ipc-main) and [ipc renderer](https://electronjs.org/docs/api/ipc-renderer).

The main is the "backend" of the launcher. It manages the windows, and all the persistent data/state of the app. It manages the state by [vuex](https://vuex.vuejs.org/). Once the state/data has been modified by a [vuex commit](https://vuex.vuejs.org/guide/mutations.html), it will broadcast a ipc message containing the [mutation info]((https://vuex.vuejs.org/guide/mutations.html)) the all the renderer. At the same time, it will trigger the save action of the modified module to write the change on disk.

The renderer is/are just (a) browsers which communicate with main. It maintains a copy of the store. (I can be a full copy, or a partial copy) User's input will trigger an [action](https://vuex.vuejs.org/guide/actions.html) or [commit](https://vuex.vuejs.org/guide/mutations.html), and it will be sync to the main. Though, it does't require any extra action for developer. The local commit and action will automatically send to main. The developer can treat the renderer as a normal vue application.

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

<details>
  <summary> 解决中国国内安装依赖（如electron）太慢的办法 </summary>

  打开你的 git bash，在`pnpm i` 前面加上 `registry=https://registry.npm.taobao.org electron_mirror="https://npm.taobao.org/mirrors/electron/"`。使用国内阿里提供的npm以及electron的镜像。

  最终输入的command也就是

  ```bash
  registry=https://registry.npm.taobao.org electron_mirror="https://npm.taobao.org/mirrors/electron/" pnpm i
  ```
</details>


#### Start Launcher

Then you can run the launcher

#### For VSCode

Go `Run and Debug` section, use the profile `Electron: Main (launch)` to start the electron. (Hot key F5)

#### For non VSCode

Open one terminal

```bash
# Start a dev server for ui
npm run dev:renderer
```

Open another terminal

``` bash
# Start watching main process code
npm run dev:main
```

#### Code Change

You have code change, and you want to update the change to the running launcher instance.

##### For Browser process

The vite provide hot reload, it should update automatically. If something went wrong, you can refresh the browser by ctrl+r.

##### For Main process

If you use VSCode to launch the launcher, after you changed the code, you can press the reload button on vscode debugger.

If you don't use VSCode to launch, it should close electron and reload automatically.

### Found something wrong in launcher core

The launcher core is in [separated project](https://github.com/voxelum/minecraft-launcher-core-node) written in typescript. 

Please open issue there if you identify any issue related to it.

#### Recommended way to interact with Vuex

- Create a new file for hook in `src/renderer/composables` folder, and export the hook throw `src/renderer/composables/index.ts`
  - Wrap vuex operation in your hook
- Import your hook by `import { yourHook } from '/@/composables'` in your vue file
- Use hook in vue file without directly access of vuex

### VSCode debugger 

The project includes vscode debugger configs. You can add breakpoint on line and debug. Currently, VSCode debugger method only supports debug on main process. 

(You can use chrome devtool for renderer process anyway)

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
