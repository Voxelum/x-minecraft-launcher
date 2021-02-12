import { Manager } from '.';

export default class PersistManager extends Manager {
    registerSerializable<T>(file: string, writer: (value: T) => Promise<void>, reader: () => Promise<T>) {

    }
}
