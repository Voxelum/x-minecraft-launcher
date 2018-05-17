# ILauncher

> An WIP Minecraft Launcher based on electron-vue 

![Image](/misc/0.png)

## Features 

 - [x] online/offline auth
 - [x] Minecraft installation & launch
 - [x] Minecraft settings toggling
 - [x] Centralize assets management
 - [x] Fetch server info & launch server
 - [x] Flatten manage server and launch profile
 - [x] Listing maps
 - [ ] Modify maps' info
 - [x] Listing resource pack
 - [ ] Preview resource pack
 - [ ] Modify resource pack
 - [x] Listing mods
 - [ ] Modify mods
 - [ ] Mod configuration
 - [x] Dynamic ui theme loading
 - [x] Dynamic appData location
 - [x] Skin preview
 - [x] Skin upload & export
 - [x] Model preview
 - [ ] Multi/Cross version matching 
 - [x] JRE detection and installation 
 - [x] Forge installation
 - [ ] Liteloader installation
 - [ ] Optifine installation
 - [x] Curseforge support
 - [ ] Plugin system

#### Contributing

This project is using [nodejs](https://nodejs.org/) + [electron](https://electron.atom.io) + [vue](https://vuejs.org).

File structure:

- locales => all the localization files
- main => main process, the guard process. Store most of the states of launcher.
    - store => store loader on main process. 
    - themes => directory that contains the windows manager of each themes
        - material.js => windows manager of material theme
        - semantic.js => windows manager of semantic theme
- renderer => renderer process, store the single state tree and display UI
    - semantic => semantic theme renderer code
        - store => the mirror store of main process store
        - components => ui template folder
        - assets => assets of semantic ui
        - main.js => entry js of semantic theme
    - material => material theme renderer code
        - assets => assets of material ui
        - main.js => entry js of material them
- universal => some universal things across the main/renderer
    - store => the definition of store
- static => static resources

Core minecraft feature is implemented [ts-minecraft](https://github.com/InfinityStudio/ts-minecraft). Therefore some bugs might be cased by this.

#### Theme Management

The main process manages the single state tree and windows startup.

The main process will first load vuex store from disk, and then determine which theme is selected according to the data in vuex store. Finally, it will load and run the selected theme code under `/src/main/themes/[selected theme].js`.

This code should open a window which starts a renderer process.

The renderer process manage the UI logic detail.

For renderer process, the webpack will check all the directories in `/src/renderer`, and it will treat each directory as an individual theme.

It will generate `[theme name].html` bundled with all its javascript code. Then the startup code `/src/main/themes/[selected theme].js` should open this html.

*The detail process might change in the future*

#### LICENSE 

[MIT](LICENSE)

#### Dev

(require nodejs installed in your pc, [nodejs download](https://nodejs.org/))

``` bash
# install dependencies
npm install

# serve with hot reload at localhost:9080
npm run dev

# build electron application for production, don't run this unless you really want to make a product env.... use npm run dev to dev
npm run build

# run unit tests, whereas no tests yet
npm test


```

#### Credit

[Jin](https://github.com/Indexyz), [LG](https://github.com/LasmGratel), [Phoebe](https://github.com/PhoebezZ), [Sumeng Wang](https://github.com/darkkingwsm), [Luca](https://github.com/LucaIsGenius), [Charles Tang](https://github.com/CharlesQT)

---

This project was generated with [electron-vue](https://github.com/SimulatedGREG/electron-vue) using [vue-cli](https://github.com/vuejs/vue-cli). Documentation about the original structure can be found [here](https://simulatedgreg.gitbooks.io/electron-vue/content/index.html).
