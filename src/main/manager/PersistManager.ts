import { JSONPersister } from '@main/util/persistance';
import { Schema } from '@universal/entities/schema';
import { MutationKeys } from '@universal/store';
import { Manager } from '.';

export default class PersistManager extends Manager {
    registerStoreJsonSerializable<T, M>(path: string, schema: Schema<T>, load: (v: T) => void | Promise<void>, save: (mutation: M) => T, mutations: Array<MutationKeys>) {
        const persist = new JSONPersister(path, schema, this.app.logManager);
        // this.app.storeManager.store.subscribe()
    }
}
