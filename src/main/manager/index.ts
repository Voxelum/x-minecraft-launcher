import { App } from 'electron';
import { Store } from 'vuex';
import AppManager from './AppManager';
import I18nManager from './I18nManager';
import NetworkManager from './NetworkManager';
import StoreAndServiceManager from './StoreAndServiceManager';
import TaskManager from './TaskManager';
import BootManager from './BootManager';
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
}
export interface Managers {
    RootManager: BootManager;
    AppManager: AppManager;
    I18nManager: I18nManager;
    NetworkManager: NetworkManager;
    StoreAndServiceManager: StoreAndServiceManager;
    TaskManager: TaskManager;
    UpdateManager: UpdateManager;
    LogManager: LogManager;
}
