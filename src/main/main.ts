import { app } from 'electron';

process.on('SIGINT', () => {
    app.quit();
});

const devMod = process.env.NODE_ENV === 'development';
/**
 * Set `__static` path to static files in production
 * https://simulatedgreg.gitbooks.io/electron-vue/content/en/using-static-assets.html
 */
if (!devMod) {
    global.__static = require('path').join(__dirname, '/static').replace(/\\\\/g, '\\\\\\\\');
}

/* eslint-disable */
if (!app.requestSingleInstanceLock()) {
    app.quit();
}

if (!app.isDefaultProtocolClient('xmcl')) {
    app.setAsDefaultProtocolClient('xmcl');
}

import { Manager, Managers } from './manager';
import AppManager from "./manager/AppManager";
import NetworkManager from "./manager/NetworkManager";
import ServiceManager from "./manager/ServiceManager";
import TaskManager from "./manager/TaskManager";
import UpdateManager from "./manager/UpdateManager";
import LogManager from './manager/LogManager';
import StoreManager from './manager/StoreManager';

const managers: Managers = {
    appManager: new AppManager(),
    networkManager: new NetworkManager(),
    serviceManager: new ServiceManager(),
    storeManager: new StoreManager(),
    taskManager: new TaskManager(),
    updateManager: new UpdateManager(),
    logManager: new LogManager(),
};
const manList: Manager[] = Object.values(managers);

async function main() {
    managers.logManager.log(process.cwd());
    managers.logManager.log(process.argv);
    manList.forEach(man => (man as any).managers = managers);
    await Promise.all(manList.map(async m => await m.setup(managers)));
    await Promise.all(manList.map(m => m.rootReady(managers.appManager.root)));
    await app.whenReady();
    await Promise.all(manList.map(m => m.appReady(app)));
    await Promise.all(manList.map(m => m.storeReady(managers.storeManager.store)));
}

main();

/* eslint-enable */
