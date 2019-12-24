import { Task, TaskHandle } from '@xmcl/task';
import { Managers } from 'main/manager';
import { MutationKeys, RootCommit, RootGetters, RootState } from 'universal/store';
import { Message } from 'universal/utils/message';
import { Exception, Exceptions } from 'universal/utils/error';

export const INJECTIONS_SYMBOL = Symbol('__injections__');
export const MUTATION_LISTENERS_SYMBOL = Symbol('__listeners__');

export function Inject(type: string) {
    return function (target: any, propertyKey: string) {
        if (!Reflect.has(target, INJECTIONS_SYMBOL)) {
            Reflect.set(target, INJECTIONS_SYMBOL, []);
        }
        if (!type) {
            console.error(new Error(`Inject recieved type: ${type}!`));
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
            console.error(new Error('Must listen at least one mutation!'));
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


/**
 * The base class of a service.
 * 
 * The service is a stateful object has life cycle. It will be created when the launcher program start, and destroied 
 */
export default class Service {
    /**
     * all the managers
     */
    protected managers!: Managers;

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

    readonly log!: typeof console.log;

    readonly error!: typeof console.error;

    readonly warn!: typeof console.warn;

    protected precondition(issue: string) {
        if (this.getters.isIssueActive(issue)) {
            throw makeException({ type: 'issueBlocked', issues: [] });
        }
    }

    protected pushMessage(m: Message) {

    }

    protected pushException(e: Exceptions) {

    }
}
