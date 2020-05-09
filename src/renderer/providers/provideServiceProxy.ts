import { TaskHandle } from '@xmcl/task';
import { reactive, provide, set } from '@vue/composition-api';
import { BuiltinServices } from '@main/service';
import { SERVICES_KEY, ipcRenderer, SERVICES_SEMAPHORE_KEY } from '@/constant';
import { release } from '@universal/util/semaphore';

export function getTasks(promise: Promise<any>): string[] {
    return Reflect.get(promise, '__tasks__');
}

function proxyOfTask(taskHandle: string): Pick<TaskHandle<any, any>, 'wait' | 'cancel' | 'pause' | 'resume'> {
    return {
        // wait(): Promise<T>;
        // /**
        //  * Cancel the task.
        //  */
        // cancel(): void;
        // /**
        //  * Pause the task if possible.
        //  */
        // pause(): void;
        // resume(): void;
    } as any;
}
async function startSession(sessionId: number | undefined, tasks: Array<any>) {
    const listener = (event: any, task: string) => {
        tasks.push(task);
    };
    ipcRenderer.on(`session-${sessionId}`, listener);
    const { result, error } = await ipcRenderer.invoke('session', sessionId);
    ipcRenderer.removeListener(`session-${sessionId}`, listener);
    if (error) {
        return Promise.reject(error);
    }
    return result;
}

function proxyService(seriv: string) {
    return new Proxy({} as any, {
        get(_, functionName) {
            const func = function (payload: any) {
                console.log(`Invoke ${seriv}.${functionName.toString()}`);
                const tasks = reactive([]);
                const promise = ipcRenderer.invoke('service-call', seriv, functionName as string, payload).then((r: any) => {
                    if (typeof r !== 'number') {
                        throw new Error(`Cannot find service call named ${functionName as string} in ${seriv}`);
                    }
                    return startSession(r, tasks);
                });
                Object.defineProperty(promise, '__tasks__', { value: tasks, enumerable: false, writable: false, configurable: false });
                return promise;
            };
            Object.defineProperty(func, 'name', { value: functionName, enumerable: false, writable: false, configurable: false });
            return func;
        },
    });
}

export const serviceProxy: BuiltinServices = new Proxy({} as any, {
    get(_, serviceName) { return proxyService(serviceName as string); },
});

export default function provideServiceProxy() {
    provide(SERVICES_KEY, serviceProxy);
    const semaphore: Record<string, number> = reactive({});
    ipcRenderer.on('aquire', (e, res) => {
        const sem = res instanceof Array ? res : [res];
        for (const s of sem) {
            if (s in semaphore) {
                semaphore[s] += 1;
            } else {
                // semaphore[s] = 1;
                set(semaphore, s, 1);
            }
        }
    });
    ipcRenderer.on('release', (e, res) => {
        release(semaphore, res);
    });
    provide(SERVICES_SEMAPHORE_KEY, semaphore);
    return serviceProxy;
}
