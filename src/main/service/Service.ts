import { Task, TaskHandle } from '@xmcl/minecraft-launcher-core';
import { Managers } from 'main/manager';
import { RootCommit, RootGetters, RootState } from 'universal/store';

export function Inject(type: string) {
    return function (target: any, propertyKey: string) {
        if (!Reflect.has(target, 'injections')) {
            Reflect.set(target, 'injections', []);
        }
        if (!type) {
            console.error(new Error(`Inject recieved type: ${type}!`));
        } else {
            Reflect.get(target, 'injections').push({ type, field: propertyKey });
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
            if (this.getters.busy(sem)) return undefined;
            this.commit('aquire', sem);
            let isPromise = false;
            try {
                const result = method.apply(this, arges);
                if (result instanceof Promise) {
                    isPromise = true;
                    result.finally(() => {
                        this.commit('release', sem);
                    });
                }
                return result;
            } finally {
                if (!isPromise) {
                    this.commit('release', sem);
                }
            }
        };
        descriptor.value = func;
    };
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
//                     this.managers.StoreAndServiceManager.store ?.watch((state) => {
//                         sem.map((s: string) => state.semaphore[s])
//                             .every((i: number) => i === 0);
//                     }, () => { resolve() });
//                 });
//             }
//         }
//         descriptor.value = func;
//     };
// }


export default class Service {
    /**
     * Submit a task into the task manager. 
     * 
     * The lifecycle of the service call will fit with the task life-cycle automatically.
     *  
     * @param task 
     */
    protected submit<T>(task: Task<T>): TaskHandle<T, Task.State> {
        return this.managers.TaskManager.submit(task);
    }

    protected state!: RootState;

    protected getters!: RootGetters;

    protected commit!: RootCommit;

    /**
     * Return the path under the storeage
     */
    protected getPath!: (...args: string[]) => string;

    /**
     * Return the path under .minecraft folder
     */
    protected getMinecraftPath!: (...args: string[]) => string;

    /**
     * The path of .minecraft
     */
    protected minecraftPath!: string;

    protected managers!: Managers;

    async save(payload: { mutation: string; payload: any }): Promise<void> { }

    async load(): Promise<void> { }

    async init(): Promise<void> { }

    readonly log: typeof console.log = () => { };

    readonly error: typeof console.error = () => { };

    readonly warn: typeof console.warn = () => { };
}
