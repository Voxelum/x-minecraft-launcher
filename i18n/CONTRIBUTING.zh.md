
### 技术栈与项目背景

在这里，我们概述了这个项目使用的工具链与运行时。

对于整个项目，我们有：

- [Node.js >=18.17.0](https://nodejs.org/). 核心库基础环境。
- [Electron 27](https://electron.atom.io). 启动器实际的运行时。
- [pnpm](https://pnpm.io/). 用于 monorepo 包管理。
- [TypeScript](https://www.typescriptlang.org/). 整个项目将尽可能使用 TypeScript 代码。

对于主进程（Electron），我们使用：

- [esbuild](https://esbuild.github.io/). 使用 esbuild 来构建主进程的 TypeScript 代码。

对于渲染侧，这是纯前端的技术栈：

- [Vue](https://vuejs.org). 用于构建用户界面。
- [Vite](https://vitejs.dev/). 用作我们的构建工具。
- [Vuetify](https://vuetifyjs.com/). 用作我们的组件库。
- [Windi CSS](https://windicss.org/). 用作 CSS 工具
- [Vue Composition API](https://github.com/vuejs/composition-api). Vue 2 的组合式 API 的桥梁。一旦 Vuetify 升级到 Vue 3，这将被删除。

### 项目文件结构

![diagram](/assets/diagram.svg)

- xmcl
  - 链接指向的 git 仓库 [launcher-core](https://github.com/voxelum/minecraft-launcher-core-node) 是本项目的一个子模块。
  - 实现核心 Minecraft 安装和启动逻辑，并将它们作为库暴露出来。
- xmcl-electron-app
  - 用 Electron 实现运行时。
  - 它依赖 xmcl-runtime。
  - 它的部分内容依赖 xmcl-keystone-ui（临时的，可能将在未来被删除）
- xmcl-keystone-ui
  - 启动器的默认 UI。
  - 100% 兼容浏览器，此项目中不涉及 Electron 的 API。
- xmcl-runtime
  - 启动器架构的核心实现。它只依赖 Node.js，不需要 Electron 运行时。
- xmcl-runtime-api
  - 这是 XMCL 运行时的共享代码与 API。它可用于渲染器应用程序（浏览器侧）

### 概念与结构

启动器由“服务器/客户端”或“主/渲染器”组成。它们通过 Electron 的 [ipcMain](https://electronjs.org/docs/api/ipc-main) 与 [ipcRenderer](https://electronjs.org/docs/api/ipc-renderer) 相互通信。

主进程 main 是启动器的“后端”。它管理窗口以及应用程序的所有持久数据与状态。它通过 [Vuex](https://vuex.vuejs.org/) 管理状态。一旦 [Vuex](https://vuex.vuejs.org/guide/mutations.html) 修改了状态/数据，它将广播一条 IPC 消息，其中包含所有渲染器的[变化信息](https://vuex.vuejs.org/guide/mutations.html)。同时会触发修改模块的保存动作，将修改写入磁盘。

渲染器只是与主进程通信的浏览器，它包含一份存储数据的副本（可以是完整的副本，也可以是只有部分内容的副本），用户的输入将触发一个 [动作 action](https://vuex.vuejs.org/guide/actions.html) 或 [提交 mutations](https://vuex.vuejs.org/guide/mutations.html)，它将自动同步到主进程。因此，不需要开发人员采取任何额外的行动。本地提交和操作将自动发送到主进程。完全可以把渲染器当作普通的 Vue 应用。

### 代码阅读指南

如果你对特定的页面逻辑感兴趣，你可以看看 `xmcl-keyston-ui/src/windows/main/views`。这个文件夹下的 `.vue` 文件是启动器中使用的主要组件。文件的前缀是用户界面的关键字。

请看一些例子：

1. `AppSideBar.vue`是侧边栏组件，`AppSideBarInstanceItem.vue`是`AppSideBar.vue`中使用的组件，代表一个实例。
2. `Curseforge.vue`是 CurseForge 页面组件，`CurseforgeCategories.vue`是`Curseforge.vue`页面中使用的类别卡。

如果你对核心逻辑感兴趣，你可以看看 `xmcl-runtime/services/`。它下面的每个文件都将一个特定领域/业务的逻辑封装成了“服务”。在阅读服务的过程中，你也需要看看 `xmcl-runtime-api/services/` 下的对应的服务声明。

一些例子：

1. `xmcl-runtime/services/InstanceService.ts`包含添加/删除/更新实例的 API 实现。`xmcl-runtime-api/services/InstanceService.ts`包含了`InstanceService`的接口。
2. `xmcl-runtime/services/InstanceVersionService.ts`包含检查实例版本健康状况的 API 实现。它将确定实例将使用什么版本，以及我们是否应该安装该版本。
3. `xmcl-runtime/services/InstallService.ts`包含安装 Minecraft/Forge/Fabric 等的API实现。
4. `xmcl-runtime/services/LaunchService.ts`包含启动实例的 API 实现。

## 开发

我们强烈建议您使用 VSCode 打开项目。

### 开始

#### 克隆

用 git 克隆项目，需要使用 `--recurse-submodules` 选项：

```bash
git clone --recurse-submodules https://github.com/Voxelum/x-minecraft-launcher
```

如果您忘记添加 `--recurse-submodules` 标志，则需要手动初始化和更新 git 子模块：

```bash
git submodule init
git submodule update
```

#### 安装依赖

使用 [pnpm](https://pnpm.io) 安装项目：

```
pnpm install
```

<details>
  <summary> 解决中国国内安装依赖（如 Electron）太慢的办法 </summary>

  打开您的 git bash，在 `pnpm i` 前面加上 `registry=https://registry.npm.taobao.org electron_mirror="https://npm.taobao.org/mirrors/electron/"`。使用国内阿里提供的 npm 以及 Electron 的镜像。

  最终输入的 command 也就是

  ```bash
  registry=https://registry.npm.taobao.org electron_mirror="https://npm.taobao.org/mirrors/electron/" pnpm i
  ```
</details>

#### 设置环境变量
在`xmcl-electron-app`下创建`.env`文件来设置`CURSEFORGE_API_KEY`。`.env`文件已被添加到`.gitignore`文件中。

**请注意保护好你的 CURSEFORGE API KEY**


#### 运行启动器

现在你可以运行开发版启动器了

#### 对于使用 VSCode 编辑器的开发者

进入 `Run and Debug` 菜单，使用配置文件 Electron: Main (launch) 来启动 Electron。（热键 F5）

#### 对于不使用 VSCode 编辑器的开发者

打开任一终端，执行命令：

```bash
# 开启一个 UI 的 dev server
npm run dev:renderer
```

打开另一终端，执行命令：

``` bash
# 开始监听主进程
npm run dev:main
```

#### 代码"热"更新

当你改了代码后，如何把把更新应用到正在跑的启动器中呢？

##### 对于浏览器进程

Vite 提供热重载，它会自动更新。如果出现问题，您可以通过 `Ctrl+R` 刷新浏览器。

##### 对于主进程

如果您使用 VSCode 启动启动器，则在更改代码后，您可以点击 VSCode 调试器上的 `reload` 按钮。

如果您不使用 VSCode 启动，则应该关闭 Electron 并重新启动。

### 在启动器核心中发现问题

启动器核心位于用 TypeScript 编写的[单独项目](https://github.com/voxelum/minecraft-launcher-core-node)中。

如果您发现任何与之相关的问题，请在此开启一个 Issue。

#### 推荐与 Vuex 交互的方式

- 在 `src/renderer/composables` 文件夹中为 hook 函数创建一个新文件，并通过 `src/renderer/composables/index.ts`导出 hook 函数。
  - 将 Vuex 操作包装在 hook 函数中。
- 通过 `import { yourHook } from '/@/composables'` 在你的 Vue 文件中导入你的 hook 函数，
- 在 Vue 文件中使用钩子访问 Vuex ，而不是直接访问 Vuex。

### VSCode 调试器

该项目包含了针对 VSCode 调试器的配置。您可以在线添加断点并进行调试。目前，VSCode 调试器方法仅支持在主进程上进行调试。

（无论如何，您都可以使用 Chrome DevTools 进行渲染进程）

我们现在有两个选择：

1. Electron: 主进程（启动）
2. Electron: 主进程 （附加方式）

如果您使用第一种方式启动，它会自动将调试器附加到实例。


### 提交你的代码

该项目遵循 [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0-beta.3/)。简而言之，提交信息的第一行应该是：

```
commit type: commit description
```

有几种可用的提交类型：`feat`, `fix`, `refactor`, `style`, `docs`, `chore`, `test`.

参考自 [这个gist](https://gist.github.com/joshbuchea/6f47e86d2510bce28f8e7f42ae84c716):

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

**如果您不遵守这些规则，您的提交将被拒绝。**

### 如何构建启动器成二进制

现在的启动器使用 2 个命令来构建

首先你需要先编译前端的代码

```bash
pnpm build:renderer
```

除非你在 `xmcl-keystone-ui` 有新的改动，你已经不需再重新跑这个命令了。

然后你需要构建 Electron，将你刚刚构建的前端代码和 Electron 打包到一起

```bash
pnpm build:all
```

如果你需要构建一个 debug 的版本用于临时 debug，你可以使用 `pnpm build:dir`。它只会产生一个包含启动器程序文件夹输出（不用打包很多其他格式了）。
