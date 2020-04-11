import { TaskHandle } from '@xmcl/task';
import { reactive, provide } from '@vue/composition-api';
import { BuiltinServices } from '@main/service';
import { SERVICES_KEY, ipcRenderer } from '@/constant';

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
    return serviceProxy;
}
