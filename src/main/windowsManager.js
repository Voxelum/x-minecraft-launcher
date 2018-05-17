import electron, {
    app, ipcMain, Tray, BrowserWindow,
} from 'electron'

import themes from './themes'

let parking; // ref for if the game is launching and the launcher is paused
let theme; // current selected theme
let instance; // current theme manager

function setupTheme(newTheme) {
    if (newTheme === theme) return;
    parking = true;

    const newSetup = themes[newTheme];
    if (!newSetup) throw new Error(`Cannot found theme ${theme}`);

    theme = newTheme;
    
    if (instance) { // stop current theme if exist
        instance.dispose();
        BrowserWindow.getAllWindows().forEach(win => win.close())
        instance = undefined;
    }

    newSetup(process.env.NODE_ENV === 'development' ?
        `http://localhost:9080/${newTheme}.html` :
        `file://${__dirname}/${newTheme}.html`)
        .then((inst) => {
            instance = inst;
        });
        
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
        setupTheme('material'/* store.getters['config/theme'] || 'semantic' */);
    } else {
        app.once('ready', () => {
            setupTheme(store.getters['config/theme'] || 'semantic');
        })
    }
    store.commit('config/themes', Object.keys(themes));
    store.watch(() => store.getters['config/theme'], setupTheme);
})
