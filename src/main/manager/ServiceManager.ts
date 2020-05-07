import AuthLibService from '@main/service/AuthLibService';
import BaseService from '@main/service/BaseService';
import CurseForgeService from '@main/service/CurseForgeService';
import DiagnoseService from '@main/service/DiagnoseService';
import InstallService from '@main/service/InstallService';
import InstanceGameSettingService from '@main/service/InstanceGameSettingService';
import { InstanceIOService } from '@main/service/InstanceIOService';
import InstanceLogService from '@main/service/InstanceLogService';
import InstanceSavesService from '@main/service/InstanceSavesService';
import InstanceService from '@main/service/InstanceService';
import JavaService from '@main/service/JavaService';
import LaunchService from '@main/service/LaunchService';
import ResourceService from '@main/service/ResourceService';
import ServerStatusService from '@main/service/ServerStatusService';
import Service, { INJECTIONS_SYMBOL, MUTATION_LISTENERS_SYMBOL } from '@main/service/Service';
import SettingService from '@main/service/SettingService';
import UserService from '@main/service/UserService';
import VersionService from '@main/service/VersionService';
import { StaticStore } from '@main/util/staticStore';
import { aquire, isBusy, release } from '@universal/util/semaphore';
import { Task, TaskHandle } from '@xmcl/task';
import { app, ipcMain } from 'electron';
import { EventEmitter } from 'events';
import { join } from 'path';
import { Manager } from '.';

// eslint-disable-next-line @typescript-eslint/type-annotation-spacing
type Constructor<T> = new () => T;

export default class ServiceManager extends Manager {
    private registeredServices: Constructor<Service>[] = [];

    private services: Service[] = [];

    private serviceMap: { [name: string]: Service } = {};

    private usedSession = 0;

    private sessions: { [key: number]: [() => Promise<void>, string] } = {};

    private mutationEventBus = new EventEmitter();

    private semaphore: Record<string, number> = {};

    getService<T extends typeof Service>(service: T): InstanceType<T> | undefined {
        return this.serviceMap[service.name] as any;
    }

    setup() {
        this.registerService(AuthLibService);
        this.registerService(CurseForgeService);
        this.registerService(DiagnoseService);
        this.registerService(InstanceService);
        this.registerService(JavaService);
        this.registerService(LaunchService);
        this.registerService(ServerStatusService);
        this.registerService(ResourceService);
        this.registerService(SettingService);
        this.registerService(UserService);
        this.registerService(InstallService);
        this.registerService(VersionService);
        this.registerService(BaseService);

        this.registerService(InstanceGameSettingService);
        this.registerService(InstanceSavesService);
        this.registerService(InstanceLogService);
        this.registerService(InstanceIOService);
    }

    aquire(res: string | string[]) {
        aquire(this.semaphore, res);
        this.managers.appManager.push('aquire', res);
    }

    release(res: string | string[]) {
        release(this.semaphore, res);
        this.managers.appManager.push('release', res);
    }

    isBusy(res: string) {
        return isBusy(this.semaphore, res);
    }

    protected registerService(s: Constructor<Service>) { this.registeredServices.push(s); }

    private setupService(store: StaticStore<any>, root: string) {
        this.log(`Setup service ${root}`);
        const userPath = join(app.getPath('appData'), 'voxelauncher');
        const managers = this.managers;
        const mcPath = join(app.getPath('appData'), this.managers.appManager.platform.name === 'osx' ? 'minecraft' : '.minecraft');

        Object.defineProperties(Service.prototype, {
            commit: { value: store.commit },
            state: { value: store.state },
            getters: { value: store.getters },
            minecraftPath: { value: mcPath },
            getPath: { value: (...args: string[]) => join(userPath, ...args) },
            getMinecraftPath: { value: (...args: string[]) => join(mcPath, ...args) },
            getGameAssetsPath: { value: (...args: string[]) => join(root, ...args) },
        });

        Object.assign(Service.prototype, managers);

        for (let ser of this.registeredServices) {
            const name = ser.name;
            Object.defineProperties(ser.prototype, {
                log: { value: (m: any, ...a: any[]) => this.managers.logManager.log(`[${name}] ${m}`, ...a) },
                warn: { value: (m: any, ...a: any[]) => this.managers.logManager.warn(`[${name}] ${m}`, ...a) },
                error: { value: (m: any, ...a: any[]) => this.managers.logManager.error(`[${name}] ${m}`, ...a) },
            });
        }

        let services: Service[] = this.services;
        for (let Ser of this.registeredServices) {
            services.push(new Ser());
        }

        let servMap = this.serviceMap;
        for (let serv of services) {
            let name = Object.getPrototypeOf(serv).constructor.name;
            if (!name) throw new Error('Name of service is undefined');
            servMap[name] = serv;
        }

        for (let serv of services) {
            let injects = Object.getPrototypeOf(serv)[INJECTIONS_SYMBOL] || [];
            for (let i of injects) {
                let { type, field } = i;

                if (type in servMap) {
                    let success = Reflect.set(serv, field, servMap[type]);
                    if (!success) {
                        throw new Error(`Cannot set service ${i} to ${Object.getPrototypeOf(serv)}`);
                    }
                } else {
                    throw new Error(`Cannot find service named ${i}! Which is required by ${Object.getPrototypeOf(serv).constructor.name}`);
                }
            }

            let mutationListeners = Object.getPrototypeOf(serv)[MUTATION_LISTENERS_SYMBOL] || [];
            for (let lis of mutationListeners) {
                this.mutationEventBus.addListener(lis.event, (payload) => lis.listener.apply(serv, [payload]));
            }
        }
    }

    async rootReady(root: string) {
        this.setupService(this.managers.storeManager.store!, root);

        for (const s of this.services) {
            for (const key of Object.keys(s)) {
                if (typeof (s as any)[key] === 'undefined') {
                    this.log(`${Object.getPrototypeOf(s).constructor.name}$${key} is undefined!!!`);
                }
            }
        }

        const startingTime = Date.now();
        await Promise.all(this.services.map(s => s.load().catch((e) => {
            this.error(`Error during load service: ${Object.getPrototypeOf(s).constructor.name}`);
            this.error(e);
        })));

        this.log(`Successfully load modules. Total Time is ${Date.now() - startingTime}ms.`);

        this.setupAutoSave();

        this.managers.storeManager.setLoadDone();
    }

    async appReady() {
        // wait app ready since in the init stage, the module can access network & others
        const startingTime = Date.now();
        try {
            await Promise.all(this.services.map(s => s.init()));
        } catch (e) {
            this.error('Error during service init:');
            this.error(e);
        }
        this.log(`Successfully init modules. Total Time is ${Date.now() - startingTime}ms.`);

        this.setupSessionReciever();
    }

    private setupSessionReciever() {
        ipcMain.handle('session', (event, id) => {
            if (!this.sessions[id]) {
                this.error(`Unknown session ${id}!`);
            }
            try {
                const r = this.sessions[id][0]();
                if (r instanceof Promise) {
                    return r.then(r => ({ result: r }), (e) => {
                        this.warn(`Error during service call session ${id}(${this.sessions[id][1]}):`);
                        this.warn(e);
                        return { error: e };
                    });
                }
                return { result: r };
            } catch (e) {
                this.warn(`Error during service call session ${id}(${this.sessions[id][1]}):`);
                this.error(e);
                return { error: e };
            }
        });
        ipcMain.handle('service-call', (event, service: string, name: string, payload: any) => {
            const serv = this.serviceMap[service];
            if (!serv) {
                this.error(`Cannot execute service call ${name} from service ${service}. The service not found.`);
            } else {
                if (name in serv) {
                    const tasks: TaskHandle<any, any>[] = [];
                    const sessionId = this.usedSession++;
                    const taskManager = this.managers.taskManager;
                    const submit = (task: Task<any>) => {
                        const handle = taskManager.submit(task);
                        event.sender.send(`session-${sessionId}`, taskManager.getHandleId(handle));
                        tasks.push(handle);
                        return handle;
                    };
                    /**
                     * Create a proxy to this specific service call to record the tasks it submit
                     */
                    const servProxy: any = new Proxy(serv, {
                        get(target, key) {
                            if (key === 'submit') { return submit; }
                            return Reflect.get(target, key);
                        },
                    });

                    this.sessions[sessionId] = [() => servProxy[name](payload), `${service}.${name}`];

                    return sessionId;
                }
                this.error(`Cannot execute service call ${name} from service ${serv}. The service doesn't have such method!`);
            }
            return undefined;
        });
    }

    /**
     * Auto save to listen any incoming mutations and call the save function for each services 
     */
    private setupAutoSave() {
        this.managers.storeManager.store!.subscribe((mutation) => {
            this.mutationEventBus.emit(mutation.type, mutation.payload);
            this.services.map(s => s.save({ mutation: mutation.type as any, payload: mutation.payload }));
        });
    }
}
