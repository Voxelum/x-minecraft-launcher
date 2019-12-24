# Voxelauncher

[![Build Status](https://travis-ci.org/voxelum/VoxeLauncher.svg?branch=master)](https://travis-ci.org/voxelum/VoxeLauncher)
[![Conventional Commits](https://img.shields.io/badge/Conventional%20Commits-1.0.0-yellow.svg)](https://conventionalcommits.org)

> An WIP Minecraft Launcher based on electron-vue 

[Old Readme](README.old.md)

## General RoadMap

Beta: Cover the basic features related to mods.

1. Be able to install Liteloader/Fabric on corresponding Minecraft version.
2. Be able to detect mod version with Forge/Fabric version and Minecraft Version (detect mod compatibility).

Want to know exact features we have? See [Feature Design vs Implemenatation](#Feature-Design-vs-Implemenatation)

## Design

### Tech Stack

This project is using [nodejs](https://nodejs.org/) + [electron](https://electron.atom.io) + [vue](https://vuejs.org).

### File structure:

- main => main process, the guard process. Store most of the states of launcher. It contains three main part and loaded in following order:
    1. app => App controller
    2. managers => The manager tend to be load
    3. services => The services exposed to the renderer process
- renderer => renderer process, store the single state tree and display UI
- universal => some universal things across the main/renderer
    - store => the definition of store
- static => static resources
  - locales => all the localization files

Core minecraft launcher logic is implemented [launcher-core](https://github.com/voxelum/ts-minecraft). Therefore some bugs might be cased by this.

### Concept/Structure

The launcher is composed by "server/client" or "main/renderer". They communicates with each other by electron's [ipc main](https://electronjs.org/docs/api/ipc-main) and [ipc renderer](https://electronjs.org/docs/api/ipc-renderer).

The main is the "backend" of the launcher. It manages the windows, and all the persistent data/state of the app. It manages the state by [vuex](https://vuex.vuejs.org/). Once the state/data has been modified by a [vuex commit](https://vuex.vuejs.org/guide/mutations.html), it will broadcast a ipc message containing the [mutation info]((https://vuex.vuejs.org/guide/mutations.html)) the all the renderer. At the same time, it will trigger the save action of the modified module to write the change on disk.

The renderer is/are just (a) browsers which communicate with main. It maintains a copy of the store. (I can be a full copy, or a partial copy) User's input will trigger an [action](https://vuex.vuejs.org/guide/actions.html) or [commit](https://vuex.vuejs.org/guide/mutations.html), and it will be sync to the main. Though, it does't require any extra action for developer. The local commit and action will automatically send to main. The developer can treat the renderer as a normal vue application.

### Project Tech Stack

After a whole refactor, the project is mostly covered by Typescript.

Though, this is not optimized now. Typescript on vue side now is lagging the dev compile time. Maybe optimize it later.

The vue part is migrating to [vue composition API](https://github.com/vuejs/composition-api) interface.

## Dev

This project is designed to easy to dev... hopefully.

### Getting Started

After you clone the project

``` bash
# optional on Windows to install build tools
npm install --global windows-build-tools

# install dependencies
npm install

# serve with hot reload at localhost:9080
npm run dev

# build electron application for production, don't run this unless you really want to make a product env.... use npm run dev to dev
npm run build

# run unit tests, whereas no tests yet
npm test
```

#### 解决中国国内安装依赖（如electron）太慢的办法

打开你的 git bash，在`npm i`前面加上`registry=https://registry.npm.taobao.org electron_mirror="https://npm.taobao.org/mirrors/electron/"`。使用国内阿里提供的npm以及electron的镜像。

最终输入的command也就是

```bash
registry=https://registry.npm.taobao.org electron_mirror="https://npm.taobao.org/mirrors/electron/" npm i
```

### Found something wrong in launcher core

The launcher core is in [seperated project](https://github.com/voxelum/minecraft-launcher-core-node) written in typescript. 

Please open issue there if you identify any issue related to it.

#### Recommended way to interact with Vuex

- Create a new file for hook in `src/renderer/hooks` folder, and export the hook throw `src/renderer/hooks/index.ts`
  - Wrap vuex operation in your hook
- Import your hook by `import { yourHook } from '@/hooks'` in your vue file
- Use hook in vue file without directly access of vuex

### Dev with VSCode debugger 

The project includes vscode debugger configs. You can add breakpoint on line and debug. Currently, VSCode debugger method only supports debug on main process. 

(You can use chrome devtool for renderer process anyway)

We have two options now:

1. Electron: Main (npm)
2. Electron: Main (attach)

Please use the attch option since the first one not work now.

With attach option, you should first run `npm run dev`, and then attach debugger by VSCode debugger UI.

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

## Feature Design vs Implemenatation

Here we list the features & corresponding files to implement the features.

| Feature                              | Core Logic File             | Related Vuex Actions                                           | Who Trigger                     | UI                          |
| ------------------------------------ | --------------------------- | -------------------------------------------------------------- | ------------------------------- | --------------------------- |
| User Login                           | user.ts                     | login                                                          | User by UI                      | DialogLogin.vue               |
| User Skin Display                    | user.ts                     | refreshSkin                                                    | -                               | UserPage.vue                |
| User Skin Upload                     | user.ts                     | uploadSkin                                                     | User by UI                      | UserPage.vue                |
| User Mojang Identity Validataition   | user.ts                     | checkLocation, getChallenges, submitChallenges                 | Launcher Initialize, User by UI | UserPage.vue                |
| User Logout                          | user.ts                     | logout                                                         | User by UI                      | UserPage.vue                |
| Launch Profile Creation              | profile.ts                  | createProfile, createAndSelectProfile                          | User by UI                      | ProfilesPage.vue            |
| Server Profile Creation              | profile.ts                  | createProfile, createAndSelectProfile, createProfileFromServer | User by UI                      | ProfilesPage.vue            |
| Edit Basic Profile Setting           | profile.ts                  | editProfile                                                    | User by UI                      | BaseSettingPage.vue         |
| Edit Launch Setting (Java)           | profile.ts                  | editProfile                                                    | User by UI                      | AdvancedSettingPage.vue     |
| Select Mods to Launch                | profile.ts                  | editProfile                                                    | User by UI                      | ModSettingPage.vue          |
| Select Resource Packs to Launch      | profile.ts                  | editProfile                                                    | User by UI                      | ResourcePackSettingPage.vue |
| Modify Game Setting                  | profile.ts                  | mutation: gamesettings                                         | User by UI                      | GameSettingPage.vue         |
| Select Launch Version                | profile.ts                  | editProfile                                                    | User by UI                      | VersionSettingPage.vue      |
| Ping Server                          | profile.ts                  | pingServer                                                     | User by UI                      | HomePage.vue                |
| Ping All Servers in a Profile        | profile.ts                  | pingServers                                                    | User by UI                      | HomePage.vue                |
| Import Modpack                       | profile.ts                  | importProfile                                                  | User by UI                      | HomePage.vue                |
| Export Modpack                       | profile.ts                  | exportProfile                                                  | User by UI                      | HomePage.vue                |
| Diagnose Profile (Detect Problems)   | diagnose.ts                 | diagnoseProfile                                                | Any Changes by editProfile      | -                           |
| Fix Profile Problems                 | diagnose.ts                 | fixProfile                                                     | User by UI                      | HomePage.vue                |
| Auto Detect Java Location on Disk    | java.ts                     | refreshLocalJava                                               | Launcher Initialize             | -                           |
| Install Java                         | java.ts                     | installJava                                                    | User by UI                      | JavaWizard.vue              |
| Fetch Minecraft Versions List        | version.ts                  | refreshMinecraft                                               | Launcher Initialize             | VersionSettingPage.vue      |
| Fetch Forge Versions List            | version.ts                  | refreshForge                                                   | User by UI, Launcher Initialize | VersionSettingPage.vue      |
| Install Minecraft Version            | version.ts                  | installMinecraft                                               | User Fix Problems               | -                           |
| Install Forge Version                | version.ts                  | installForge                                                   | User Fix Problems               | -                           |
| Scan Installed Versions on Disk      | version.ts                  | refreshVersions                                                | User Fix Problems               | -                           |
| Install Version Missing Dependencies | version.ts                  | installDependencies                                            | User Fix Problems               | -                           |
| Import Mods                          | resource.ts                 | importResource                                                 | User by UI                      | ModSettingPage.vue          |
| Import Resource Packs                | resource.ts                 | importResource                                                 | User by UI                      | ResourcePackSettingPage.vue |
| Display Mod Compatibility            | universal/utils/versions.ts | -                                                              | UI Initialize                   | ModCard.vue                 |
| Display Resource Pack Compatibility  | universal/utils/versions.ts | -                                                              | UI Initialize                   | ResourcePackCard.vue        |


## LICENSE 

[MIT](LICENSE)

## Credit

[Jin](https://github.com/Indexyz), [LG](https://github.com/LasmGratel), [Phoebe](https://github.com/PhoebezZ), [Sumeng Wang](https://github.com/darkkingwsm), [Luca](https://github.com/LucaIsGenius), [Charles Tang](https://github.com/CharlesQT)

---

This project was generated with [electron-vue](https://github.com/SimulatedGREG/electron-vue) using [vue-cli](https://github.com/vuejs/vue-cli). Documentation about the original structure can be found [here](https://simulatedgreg.gitbooks.io/electron-vue/content/index.html).

