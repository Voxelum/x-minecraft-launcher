import { StaticStore } from '@main/util/staticStore';
import { App } from 'electron';
import AppManager from './AppManager';
import LogManager from './LogManager';
import NetworkManager from './NetworkManager';
import ServiceManager from './ServiceManager';
import StoreManager from './StoreManager';
import TaskManager from './TaskManager';
import UpdateManager from './UpdateManager';

export abstract class Manager {
    protected managers!: Managers;
    /* eslint-disable */
    setup(map: Managers): Promise<void> | void { }

    rootReady(root: string): Promise<void> | void { }

    appReady(app: App): Promise<void> | void { }

    storeReady(store: StaticStore<any>): Promise<void> | void { }
    /* eslint-enable */

    log(m: any, ...args: any[]) { this.managers.logManager.log(m, ...args); }

    warn(m: any, ...args: any[]) { this.managers.logManager.warn(m, ...args); }

    error(m: any, ...args: any[]) { this.managers.logManager.error(m, ...args); }
}
export interface Managers {
    appManager: AppManager;
    networkManager: NetworkManager;
    serviceManager: ServiceManager;
    taskManager: TaskManager;
    updateManager: UpdateManager;
    logManager: LogManager;
    storeManager: StoreManager;
}
