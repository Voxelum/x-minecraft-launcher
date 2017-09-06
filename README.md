# ILauncher

> An Minecraft Launcher based on electron-vue

## Problems and Solutions

To play Minecraft, players always need various pre-knowledge to handle so many minecraft technical stuff. Even they might know how to do, they still need maintain Minecraft game folder by their own, repeating doing the copy and paste to work. 

Installing a mod requires player download and move the mod file into the mods folder by hand. And if you want to have various mods combination, sometimes you have to keep various minecraft version/game folders. Things become complicated. (Especially for the modpack maker)

This launcher is trying to solve these barrier in the minecraft launching. Though, the complexity of this *launcher* is much higher than normal one. Therefore, I personally want to call it a **Integrated Minecraft Environment**.

My motivation of this project is simple: I'm totally feel tired about manage the multiple minecraft game assets by hand. Therefore, the ultimate goal of this project is **free player hand** ~~(and brain, which makes you life much better and easier)~~.

In this situation, players don't need to ever touch the game files. They don't even need to care about these things. Just care about what game expirence they want and whatever. ~~(That is hard. I hope I could achive this)~~
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
 - [ ] Dynamic ui theme loading
 - [ ] Dynamic appData location
 - [ ] Skin preview
 - [ ] Skin upload & export
 - [ ] Model preview
 - [x] JRE detection and installation 
 - [ ] Forge installation
 - [ ] Liteloader installation
 - [ ] Optifine installation
 - [ ] Curseforge support
 - [ ] Plugin system

#### Contributing

File structure:

- locales => all the localization files
- main => main process, handle/dispatch complex task
    - service => provide some specific service that renderer process can query. 
- renderer => renderer process, store the single state tree and display UI
    - store => define the single state tree
        - modules => all the standalone sub-modules
    - ui => ui template folder, share same single state tree
        - semantic => semantic ui
        - material => material ui
- static => static resources
- test => test files

Core minecraft feature is implemented [ts-minecraft](https://github.com/InfinityStudio/ts-minecraft). Therefore some bugs might be cased by this.

Creating new UI is simple since all UI share same state tree.
Just adding a new folder under the `src/renderer/ui` folder.

#### LICENSE 

[MIT](LICENSE)

#### Build Setup

``` bash
# install dependencies
npm install

# serve with hot reload at localhost:9080
npm run dev

# build electron application for production
npm run build

# run unit tests
npm test


```

---

This project was generated with [electron-vue](https://github.com/SimulatedGREG/electron-vue) using [vue-cli](https://github.com/vuejs/vue-cli). Documentation about the original structure can be found [here](https://simulatedgreg.gitbooks.io/electron-vue/content/index.html).
