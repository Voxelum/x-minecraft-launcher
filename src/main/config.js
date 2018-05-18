import electron, {
    app, ipcMain,
} from 'electron'

import fs from 'fs-extra'
import path from 'path';

let root = process.env.LAUNCHER_ROOT;
const appData = app.getPath('appData');
const cfgFile = `${appData}/launcher.json`;

if (app.makeSingleInstance(() => { })) {
    app.quit();
}

ipcMain.on('reset', (event, newRoot) => {
    if (newRoot !== root) {
        app.setPath('userData', newRoot);
        ipcMain.emit('reload');
        fs.writeFile(cfgFile, JSON.stringify({ path: root }));
    }
});

async function setup() {
    try {
        const buf = await fs.readFile(cfgFile);
        const cfg = JSON.parse(buf.toString());
        root = cfg.root || path.join(appData, '.launcher');
    } catch (e) {
        root = path.join(appData, '.launcher');
    }
    app.setPath('userData', root);
    ipcMain.emit('reload');
}
setup();
