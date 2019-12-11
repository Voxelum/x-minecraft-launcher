import { TaskHandle } from '@xmcl/minecraft-launcher-core';
import { reactive, provide } from '@vue/composition-api';
import { BuiltinServices } from 'main/service';
import { SERVICES_KEY, ipcRenderer } from 'renderer/constant';

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
async function startSession(sessionId: string | undefined, tasks: Array<any>) {
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

function proxyOfService(seriv: string) {
    return new Proxy({} as any, {
        get(_, key) {
            const func = function (payload: any) {
                const tasks = reactive([]);
                const promise = ipcRenderer.invoke('service-call', seriv, key as string, payload).then((r: any) => {
                    if (!r) {
                        throw new Error(`Cannot find service call named ${key as string} in ${seriv}`);
                    }
                    return startSession(r, tasks);
                });
                Object.defineProperty(promise, '__tasks__', { value: tasks, enumerable: false, writable: false, configurable: false });
                return promise;
            };
            Object.defineProperty(func, 'name', { value: key, enumerable: false, writable: false, configurable: false });
            return func;
        },
    });
}

export default function provideServiceProxy() {
    const caller: BuiltinServices = new Proxy({} as any, {
        get(_, key) {
            return proxyOfService(key as string);
        },
    });
    provide(SERVICES_KEY, caller);
}
