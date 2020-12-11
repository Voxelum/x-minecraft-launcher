import { reactive, provide, set, ref, Ref } from '@vue/composition-api';
import { BuiltinServices } from '@main/service';
import { SERVICES_KEY, ipcRenderer, SERVICES_SEMAPHORE_KEY } from '@/constant';
import { release } from '@universal/util/semaphore';

export function getServiceCallTasks(promise: Readonly<Promise<any>>): Ref<string[]> {
    return Reflect.get(promise, '__tasks__');
}

async function startSession(sessionId: number | undefined, tasks: Ref<Array<any>>) {
    const listener = (event: any, task: string) => {
        tasks.value.push(task);
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
                const tasks = ref([]);
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
                set(semaphore, s, 1);
            }
        }
    });
    ipcRenderer.on('release', (e, res) => {
        const sem = res instanceof Array ? res : [res];
        for (const s of sem) {
            if (s in semaphore) {
                semaphore[s] = Math.max(0, semaphore[s] - 1);
            } else {
                set(semaphore, s, 0);
            }
        }
    });
    provide(SERVICES_SEMAPHORE_KEY, semaphore);
    return serviceProxy;
}
