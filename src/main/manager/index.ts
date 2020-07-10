import LauncherApp from '@main/app/LauncherApp';
import { StaticStore } from '@universal/util/staticStore';
import LogManager from './LogManager';
import NetworkManager from './NetworkManager';
import ServiceManager from './ServiceManager';
import StoreManager from './StoreManager';
import TaskManager from './TaskManager';

export abstract class Manager {
    constructor(protected app: LauncherApp) { }

    private name: string = Object.getPrototypeOf(this).constructor.name;

    /* eslint-disable */
    setup(): Promise<void> | void { }

    rootReady(root: string): Promise<void> | void { }

    engineReady(): Promise<void> | void { }

    storeReady(store: StaticStore<any>): Promise<void> | void { }
    /* eslint-enable */

    log(m: any, ...args: any[]) { this.app.logManager.log(`[${this.name}] ${m}`, ...args); }

    warn(m: any, ...args: any[]) { this.app.logManager.warn(`[${this.name}] ${m}`, ...args); }

    error(m: any, ...args: any[]) { this.app.logManager.error(`[${this.name}] ${m}`, ...args); }
}
export interface Managers {
    networkManager: NetworkManager;
    serviceManager: ServiceManager;
    taskManager: TaskManager;
    logManager: LogManager;
    storeManager: StoreManager;
}
