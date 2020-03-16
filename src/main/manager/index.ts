import { App } from 'electron';
import { Store } from 'vuex';
import AppManager from './AppManager';
import NetworkManager from './NetworkManager';
import StoreAndServiceManager from './StoreAndServiceManager';
import TaskManager from './TaskManager';
import UpdateManager from './UpdateManager';
import LogManager from './LogManager';

export abstract class Manager {
    protected managers!: Managers;
    /* eslint-disable */
    setup(map: Managers): Promise<void> | void { }

    rootReady(root: string): Promise<void> | void { }

    appReady(app: App): Promise<void> | void { }

    storeReady(store: Store<any>): Promise<void> | void { }
    /* eslint-enable */

    log(m: any, ...args: any[]) { this.managers.logManager.log(m, ...args); }

    warn(m: any, ...args: any[]) { this.managers.logManager.warn(m, ...args); }

    error(m: any, ...args: any[]) { this.managers.logManager.error(m, ...args); }
}
export interface Managers {
    appManager: AppManager;
    networkManager: NetworkManager;
    storeAndServiceManager: StoreAndServiceManager;
    taskManager: TaskManager;
    updateManager: UpdateManager;
    logManager: LogManager;
}
