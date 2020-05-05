import { Managers } from '@main/manager';
import { MutationKeys, RootCommit, RootGetters, RootState } from '@universal/store';
import { Exception, Exceptions } from '@universal/util/exception';
import { Task, TaskHandle } from '@xmcl/task';
import NetworkManager from '@main/manager/NetworkManager';
import AppManager from '@main/manager/AppManager';
import StoreAndServiceManager from '@main/manager/StoreAndServiceManager';
import TaskManager from '@main/manager/TaskManager';
import UpdateManager from '@main/manager/UpdateManager';
import LogManager from '@main/manager/LogManager';
import { createContext, runInContext } from 'vm';
import { readFile, ensureFile, writeFile } from 'fs-extra';
import Ajv from 'ajv';
import Schema from '@universal/store/Schema';

export const INJECTIONS_SYMBOL = Symbol('__injections__');
export const MUTATION_LISTENERS_SYMBOL = Symbol('__listeners__');

export function Inject(type: string) {
    return function (target: any, propertyKey: string) {
        if (!Reflect.has(target, INJECTIONS_SYMBOL)) {
            Reflect.set(target, INJECTIONS_SYMBOL, []);
        }
        if (!type) {
            throw new Error(`Inject recieved type: ${type}!`);
        } else {
            Reflect.get(target, INJECTIONS_SYMBOL).push({ type, field: propertyKey });
        }
    };
}

/**
 * Fire on certain store mutation committed.
 * @param keys The mutations name
 */
export function MutationTrigger(...keys: MutationKeys[]) {
    return function (target: Service, propertyKey: string, descriptor: PropertyDescriptor) {
        if (!Reflect.has(target, MUTATION_LISTENERS_SYMBOL)) {
            Reflect.set(target, MUTATION_LISTENERS_SYMBOL, []);
        }
        if (!keys || keys.length === 0) {
            throw new Error('Must listen at least one mutation!');
        } else {
            Reflect.get(target, MUTATION_LISTENERS_SYMBOL).push(...keys.map(k => ({
                event: k,
                listener: descriptor.value,
            })));
        }
    };
}

/**
 * A service method decorator to make sure this service call should run in singleton -- no second call at the time. 
 */
export function Singleton(...keys: string[]) {
    return function (target: Service, propertyKey: string, descriptor: PropertyDescriptor) {
        const method = descriptor.value;
        const sem: any = [propertyKey, ...keys];
        const func = function (this: Service, ...arges: any[]) {
            if (this.isBusy(sem)) return undefined;
            this.aquire(sem);
            let isPromise = false;
            try {
                const result = method.apply(this, arges);
                if (result instanceof Promise) {
                    isPromise = true;
                    result.finally(() => {
                        this.release(sem);
                    });
                }
                return result;
            } finally {
                if (!isPromise) {
                    this.release(sem);
                }
            }
        };
        descriptor.value = func;
    };
}

export class ServiceException extends Error {
    constructor(readonly exception: Exceptions, message?: string) {
        super(message);
    }
}

// /**
//  * A service method decorator to make sure this service call should run in singleton -- no second call at the time. 
//  */
// export function Queue(...keys: string[]) {
//     return function (target: Service, propertyKey: string, descriptor: PropertyDescriptor) {
//         const method = descriptor.value;
//         const sem: any = [propertyKey, ...keys];
//         const func = function (this: Service) {
//             if (this.getters.busy(sem)) {
//                 new Promise((resolve) => {
//                     this.StoreAndServiceManager.store ?.watch((state) => {
//                         sem.map((s: string) => state.semaphore[s])
//                             .every((i: number) => i === 0);
//                     }, () => { resolve() });
//                 });
//             }
//         }
//         descriptor.value = func;
//     };
// }


/**
 * The base class of a service.
 * 
 * The service is a stateful object has life cycle. It will be created when the launcher program start, and destroied 
 */
export default class Service implements Managers {
    appManager!: AppManager;

    networkManager!: NetworkManager;

    storeAndServiceManager!: StoreAndServiceManager;

    taskManager!: TaskManager;

    updateManager!: UpdateManager;

    logManager!: LogManager;

    /**
     * Submit a task into the task manager. 
     * 
     * The lifecycle of the service call will fit with the task life-cycle automatically.
     *  
     * @param task 
     */
    protected submit<T>(task: Task<T>): TaskHandle<T, Task.State> {
        return this.taskManager.submit(task);
    }

    /**
     * The managed state
     */
    protected state!: RootState;

    /**
     * The managed getter
     */
    protected getters!: RootGetters;

    /**
     * The commit method
     */
    protected commit!: RootCommit;

    /**
     * Return the path under the config root
     */
    protected getPath!: (...args: string[]) => string;

    /**
     * Return the path under game libraries/assets root
     */
    protected getGameAssetsPath!: (...args: string[]) => string;

    /**
     * Return the path under .minecraft folder
     */
    protected getMinecraftPath!: (...args: string[]) => string;

    /**
     * The path of .minecraft
     */
    protected minecraftPath!: string;

    async save(payload: { mutation: MutationKeys; payload: any }): Promise<void> { }

    async load(): Promise<void> { }

    async init(): Promise<void> { }

    protected readonly log!: typeof console.log;

    protected readonly error!: typeof console.error;

    protected readonly warn!: typeof console.warn;

    protected isBusy(key: string) {
        return this.storeAndServiceManager.isBusy(key);
    }

    protected aquire(key: string | string[]) {
        this.storeAndServiceManager.aquire(key);
    }

    protected release(key: string | string[]) {
        this.storeAndServiceManager.release(key);
    }

    protected precondition(issue: string) {
        if (this.getters.isIssueActive(issue)) {
            throw new Exception({ type: 'issueBlocked', issues: [] });
        }
    }

    protected pushException(e: Exceptions) {

    }

    protected async setPersistence<T>({ path, data, schema }: { path: string; data: T; schema?: Schema<T> }) {
        const deepCopy = JSON.parse(JSON.stringify(data));
        if (schema) {
            const schemaObject = schema;
            const ajv = new Ajv({ useDefaults: true, removeAdditional: true });
            const validation = ajv.compile(schemaObject);
            const valid = validation(deepCopy);
            if (!valid) {
                const context = createContext({ object: deepCopy });
                if (validation.errors) {
                    let message = `Error to persist to the disk path "${path}" with datatype ${typeof data}:\n`;
                    validation.errors.forEach(e => {
                        message += `- ${e.keyword} error @[${e.dataPath}:${e.schemaPath}]: ${e.message}\n`;
                    });
                    const cmd = validation.errors.map(e => `delete object${e.dataPath};`);
                    this.log(message);
                    this.log(cmd.join('\n'));
                    runInContext(cmd.join('\n'), context);
                }
            }
        }
        await ensureFile(path);
        await writeFile(path, JSON.stringify(deepCopy, null, 4), { encoding: 'utf-8' });
    }

    protected async getPersistence<T>(option: { path: string; schema?: Schema<T> }): Promise<T> {
        const { path, schema } = option;
        const originalString = await readFile(path).then(b => b.toString(), () => '{}');
        const object = JSON.parse(originalString);
        if (object && schema) {
            const schemaObject = schema;
            const ajv = new Ajv({ useDefaults: true, removeAdditional: true });
            const validation = ajv.compile(schemaObject);
            const valid = validation(object);
            if (!valid) {
                // this.warn('Try to remove those invalid keys. This might cause problem.');
                // this.warn(originalString);
                const context = createContext({ object });
                if (validation.errors) {
                    // this.warn(`Found invalid config file on ${path}.`);
                    // validation.errors.forEach(e => this.warn(e));
                    const cmd = validation.errors.filter(e => e.dataPath).map(e => `delete object${e.dataPath};`);
                    if (cmd.length !== 0) {
                        // this.log(cmd.join('\n'));
                        runInContext(cmd.join('\n'), context);
                    }
                }
            }
        }

        return object;
    }
}
