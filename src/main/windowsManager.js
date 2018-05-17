import electron, {
    app, ipcMain, Tray,
} from 'electron'

import themes from './themes'

export default async function setup(store) {
    store.commit('appearance/themes', Object.keys(themes));

    let theme;
    let instance;

    function setupTheme(newTheme) {
        if (newTheme === theme) return;
        const newSetup = themes[newTheme];
        if (!newSetup) throw new Error(`Cannot found theme ${theme}`);

        theme = newTheme;
        if (instance) {
            instance.dispose();
            instance = undefined;
        }

        newSetup(process.env.NODE_ENV === 'development' ?
            `http://localhost:9080/${newTheme}.html` :
            `file://${__dirname}/${newTheme}.html`)
            .then((inst) => {
                instance = inst;
            });
    }
    if (app.isReady()) {
        setupTheme('material'/* store.getters['appearance/theme'] || 'semantic' */);
    } else {
        app.once('ready', () => {
            console.log('r')
            setupTheme(store.getters['appearance/theme'] || 'semantic');
        })
    }
    store.watch(() => store.getters['appearance/theme'], setupTheme);
    // const themeSetup = themes[theme];
    // if (!themeSetup) throw new Error(`Cannot found theme ${theme}`);
    // instance = await themeSetup(process.env.NODE_ENV === 'development' ?
    //     `http://localhost:9080/${theme}.html` :
    //     `file://${__dirname}/${theme}.html`);
    return store;
}
