
### 技术栈与项目背景

在这里，我们概述了这个项目使用的工具链与运行时。

对于整个项目，我们有：

- [nodejs 14](https://nodejs.org/). 核心库基础环境。一些构建用的脚本基于Node 14。
- [electron 15](https://electron.atom.io). 启动器实际的运行时。
- [pnpm](https://pnpm.io/). 用于 monorepo 包管理。
- [typescript](https://www.typescriptlang.org/). 整个项目将尽可能使用 Typescript 代码。

对于主进程（Electron），我们使用：

- [esbuild](https://esbuild.github.io/). 使用 esbuild 来构建主进程的 Typescript 代码。

对于渲染侧，这是纯前端的技术栈：

- [vue](https://vuejs.org). 用于构建用户界面。
- [vite](https://vitejs.dev/). 用作我们的构建工具。
- [vuetify](https://vuetifyjs.com/). 用作我们的组件库。
- [windicss](https://windicss.org/). 用作css工具
- [vue composition API](https://github.com/vuejs/composition-api). vue 2 的组合式 API 的桥梁。一旦 vuetify 升级到 vue 3，这将被删除。

### Project structure

![diagram](/assets/diagram.svg)

- xmcl
  - 链接指向的git仓库 [launcher-core](https://github.com/voxelum/minecraft-launcher-core-node) 是本项目的一个子模块。
  - 实现核心 Minecraft 安装和启动逻辑，并将它们作为库暴露出来。
- xmcl-electron-app
  - 用 electron 实现运行时。
  - 它依赖 xmcl-runtime。
  - 它的部分内容依赖 xmcl-keystone-ui （临时的，可能将在未来被删除）
- xmcl-keystone-ui
  - 启动器的默认UI。
  - 100%兼容浏览器，此项目中不涉及 electron 的 API。
- xmcl-runtime
  - 启动器架构的核心实现。它只依赖 nodejs，不需要 electron 运行时。
- xmcl-runtime-api
  - 这是 xml 运行时的共享代码与 API。它可用于渲染器应用程序（浏览器侧）

### 概念与结构

启动器由“服务器/客户端”或“主/渲染器”组成。它们通过 electron 的 [ipc main](https://electronjs.org/docs/api/ipc-main) 与 [ipc renderer](https://electronjs.org/docs/api/ipc-renderer) 相互通信。

主进程 main 是启动器的“后端”。它管理窗口以及应用程序的所有持久数据与状态。它通过 [vuex](https://vuex.vuejs.org/) 管理状态。一旦 [vuex](https://vuex.vuejs.org/guide/mutations.html) 修改了状态/数据，它将广播一条 ipc 消息，其中包含所有渲染器的[变化信息](https://vuex.vuejs.org/guide/mutations.html)。同时会触发修改模块的保存动作，将修改写入磁盘。

渲染器只是与主进程通信的浏览器，它包含一份存储数据的副本（可以是完整的副本，也可以是只有部分内容的副本），用户的输入将触发一个 [动作 action](https://vuex.vuejs.org/guide/actions.html) 或 [提交 mutations](https://vuex.vuejs.org/guide/mutations.html)，它将自动同步到主进程。因此，不需要开发人员采取任何额外的行动。本地提交和操作将自动发送到主进程。完全可以把渲染器当作普通的 vue 应用。

## 贡献

我们强烈建议您使用 VSCode 打开项目。

### 开始

#### 克隆

使用子模块标志 `--recurse-submodules` 克隆项目：

```bash
git clone --recurse-submodules https://github.com/Voxelum/x-minecraft-launcher
```

如果您忘记添加 `--recurse-submodules` 标志，则需要手动初始化和更新 git 子模块：

```bash
git submodule init
git submodule update
```

#### 安装

使用 [pnpm](https://pnpm.io) 安装项目：

```
pnpm install
```

<details>
  <summary> 解决中国国内安装依赖（如electron）太慢的办法 </summary>

  打开您的 git bash，在`pnpm i` 前面加上 `registry=https://registry.npm.taobao.org electron_mirror="https://npm.taobao.org/mirrors/electron/"`。使用国内阿里提供的npm以及electron的镜像。

  最终输入的command也就是

  ```bash
  registry=https://registry.npm.taobao.org electron_mirror="https://npm.taobao.org/mirrors/electron/" pnpm i
  ```
</details>


#### 运行启动器

然后你可以运行启动器

#### 对于使用 VSCode 编辑器的开发者

进入`Run and Debug`菜单，使用配置文件 Electron: Main (launch) 来启动electron。（热键 F5）

#### 对于不使用 VSCode 编辑器的开发者

打开任一终端，执行命令：

```bash
# 开启一个 ui 的 dev server
npm run dev:renderer
```

打开另一终端，执行命令：

``` bash
# 开始监听主进程
npm run dev:main
```

#### 代码更新

当代码更新，并且您希望将更新后的效果应用到正在运行的启动器实例。

##### 对于浏览器进程

vite 提供热重载，它会自动更新。如果出现问题，您可以通过 `ctrl+r` 刷新浏览器。

##### 对于主进程

如果您使用 VSCode 启动启动器，则在更改代码后，您可以点击 vscode 调试器上的 `reload` 按钮。

如果您不使用 VSCode 启动，则应该关闭 electron 并重新重新启动。

### 在启动器核心中发现问题

启动器核心位于用 Typescript 编写的[单独项目](https://github.com/voxelum/minecraft-launcher-core-node)中。

如果您发现任何与之相关的问题，请在此开启一个 Issue。

#### 推荐与 Vuex 交互的方式

- 在 `src/renderer/composables` 文件夹中为 hook 函数创建一个新文件，并通过 `src/renderer/composables/index.ts`导出 hook 函数。
  - 将 vuex 操作包装在 hook 函数中。
- 通过 `import { yourHook } from '/@/composables'` 在你的 vue 文件中导入你的 hook 函数，
- 在 vue 文件中使用钩子访问 vuex ，而不是直接访问 vuex。

### VSCode 调试器

该项目包含了针对 VSCode 调试器的配置。您可以在线添加断点并进行调试。目前，VSCode 调试器方法仅支持在主进程上进行调试。

（无论如何，您都可以使用 chrome devtool 进行渲染进程）

我们现在有两个选择：

1. Electron: 主进程（启动）
2. Electron: 主进程 （附加方式）

如果您使用第一种方式启动，它会自动将调试器附加到实例。


### 提交你的代码

该项目遵循 [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0-beta.3/)。 简而言之，提交信息的第一行应该是：

```
commit type: commit description
```

有几种可用的提交类型： `feat`, `fix`, `refactor`, `style`, `docs`, `chore`, `test`.

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
