import electron, {
    app, ipcMain,
} from 'electron'

import fs from 'fs-extra'
import path from 'path';

/**
 * Setup root
 */
export default async function setup() {
    if (app.makeSingleInstance(() => { })) {
        app.quit();
        return;
    }

    let root = process.env.LAUNCHER_ROOT;
    const appData = app.getPath('appData');
    const cfgFile = `${appData}/launcher.json`;

    try {
        const buf = await fs.readFile(cfgFile);
        const cfg = JSON.parse(buf.toString());
        root = cfg.root || path.join(appData, '.launcher');
        app.setPath('userData', root);
        console.log(root);
    } catch (e) {
        root = path.join(appData, '.launcher');
        app.setPath('userData', root);
        await fs.writeFile(cfgFile, JSON.stringify({ path: root }));
    }

    ipcMain.on('reset', (event, newRoot) => {
        if (newRoot !== root) {
            app.setPath('userData', newRoot);
            fs.writeFile(cfgFile, JSON.stringify({ path: root }));
        }
    })
}
