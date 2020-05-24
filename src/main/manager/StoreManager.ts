import { StaticStore, createStaticStore } from '@main/util/staticStore';
import storeTemplate from '@universal/store';
import { ipcMain } from 'electron';
import { Manager } from '.';

export default class StoreManager extends Manager {
    public store: StaticStore<any> = createStaticStore(storeTemplate);

    private checkPointId = 0;

    private checkPoint: any;

    private storeReadyCb = () => { };

    private storeReadyPromise = new Promise((resolve) => {
        this.storeReadyCb = resolve;
    })

    setLoadDone() {
        this.storeReadyCb();
    }

    sync(currentId: number) {
        const checkPointId = this.checkPointId;
        this.log(`Sync from renderer: ${currentId}, main: ${checkPointId}.`);
        if (currentId === checkPointId) {
            return undefined;
        }
        return {
            state: JSON.parse(JSON.stringify(this.checkPoint)),
            length: checkPointId,
        };
    }

    /**
     * Auto sync will watch every mutation and send to each client,
     * and it will response for `sync` channel which will send the mutation histories to the client.
     */
    private setupAutoSync() {
        this.store!.subscribe((mutation, state) => {
            this.checkPoint = state;
            this.checkPointId += 1; // record the total order
            this.managers.appManager.push('commit', mutation, this.checkPointId);
        });
    }

    // SETUP CODE

    setup() {
        ipcMain.handle('sync', (_, id) => this.storeReadyPromise.then(() => this.sync(id)));
    }

    rootReady(root: string) {
        this.store!.commit('root', root);
        this.setupAutoSync();
    }

    appReady() {
        ipcMain.handle('commit', (event, type, payload) => {
            this.store!.commit(type, payload);
        });
    }
}
