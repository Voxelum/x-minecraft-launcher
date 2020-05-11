import { Managers } from '@main/manager';
import AppManager from '@main/manager/AppManager';
import LogManager from '@main/manager/LogManager';
import NetworkManager from '@main/manager/NetworkManager';
import ServiceManager from '@main/manager/ServiceManager';
import StoreManager from '@main/manager/StoreManager';
import TaskManager from '@main/manager/TaskManager';
import UpdateManager from '@main/manager/UpdateManager';
import { app, ipcMain } from 'electron';
import { readJson } from 'fs-extra';
import { join } from 'path';
import { AppContext, LoggerFacade } from './AppContext';

const appData = app.getPath('appData');
const persistRoot = `${appData}/voxelauncher`;
const cfgFile = `${appData}/voxelauncher/launcher.json`;


export async function boot() {
    const appContext: AppContext = {
        root: persistRoot,
    };
    const logFacade: LoggerFacade = { log() { }, warn() { }, error() { } };
    const managers: Managers = {
        appManager: new AppManager(appContext, logFacade),
        networkManager: new NetworkManager(appContext, logFacade),
        serviceManager: new ServiceManager(appContext, logFacade),
        storeManager: new StoreManager(appContext, logFacade),
        taskManager: new TaskManager(appContext, logFacade),
        updateManager: new UpdateManager(appContext, logFacade),
        logManager: new LogManager(appContext, logFacade),
    };
}


export async function setup(managers: Managers) {
    let root;
    try {
        const cfg = await readJson(cfgFile);
        root = cfg.path || join(appData, 'voxelauncher');
    } catch (e) {
        root = join(appData, 'voxelauncher');
    }
    await this.persistRoot(root);

    let syncResolves = [];
    ipcMain.handle('sync', (_, id) => new Promise((resolve) => {
        syncResolves.push(resolve);
    }).then(() => managers.storeManager.sync(id)));

    managers.logManager.redirectLogPipeline(root);
}

async function rootReady(managers: Managers, root: string) {
    const store = managers.storeManager.store!;
    const serviceManager = managers.serviceManager;
    serviceManager.setupServices(
        app.getPath('appData'),
        managers.appManager.platform,
        managers.logManager,
        managers,
        store,
        root,
    );
    await serviceManager.loadServices();
    serviceManager.setupAutoSave(store);
}

async function appReady(managers: Managers) {
    const serviceManager = managers.serviceManager;
    await serviceManager.initializeService();
    ipcMain.handle('session', (event, id) => {
        serviceManager.startServiceCall(id);
    });
    ipcMain.handle('service-call', (event, service: string, name: string, payload: any) => {
        serviceManager.prepareServiceCall(event.sender, service, name, payload);
    });
}