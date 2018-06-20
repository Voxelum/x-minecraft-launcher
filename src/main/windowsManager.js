import electron, {
    app, ipcMain, Tray, BrowserWindow,
} from 'electron'

import themes from './themes'

let parking; // ref for if the game is launching and the launcher is paused
let theme; // current selected theme
let instance; // current theme manager

function setupTheme(newTheme) {
    console.log(`setup theme ${newTheme}`)
    if (newTheme === theme) return;
    parking = true;

    const newSetup = themes[newTheme];
    if (!newSetup) throw new Error(`Cannot found theme ${theme}`);


    if (instance) { // stop current theme if exist
        console.log('dispose current theme')
        try {
            instance.dispose();
        } catch (e) {
            console.warn(`An error occure during dispose ${theme}`);
            console.error(e);
        }
        BrowserWindow.getAllWindows().forEach(win => win.close())
        instance = undefined;
    }
    theme = newTheme;

    instance = newSetup(process.env.NODE_ENV === 'development' ?
        `http://localhost:9080/${newTheme}.html` :
        `file://${__dirname}/${newTheme}.html`)

    console.log('instance')
    console.log(instance);

    parking = false;
}

app.on('window-all-closed', () => {
    if (parking) return;
    if (process.platform !== 'darwin') {
        app.quit()
    }
})
ipcMain.on('exit', () => {
    app.quit()
})
ipcMain.on('minecraft-exit', () => {
    parking = false;
})
ipcMain.on('minecraft-start', () => {
    parking = true;
})
ipcMain.on('store-ready', (store) => {
    if (app.isReady()) {
        setupTheme(store.state.config.theme || 'semantic');
    } else {
        app.once('ready', () => {
            setupTheme(store.state.config.theme || 'semantic');
        })
    }
    theme = undefined;
    store.commit('config/themes', Object.keys(themes));
    store.watch(state => state.config.theme, setupTheme);
})
