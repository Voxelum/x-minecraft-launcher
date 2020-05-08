import { LoggerFacade } from '@main/app/AppContext';
import AuthLibService from '@main/service/AuthLibService';
import BaseService from '@main/service/BaseService';
import CurseForgeService from '@main/service/CurseForgeService';
import DiagnoseService from '@main/service/DiagnoseService';
import InstallService from '@main/service/InstallService';
import InstanceGameSettingService from '@main/service/InstanceGameSettingService';
import InstanceIOService from '@main/service/InstanceIOService';
import InstanceLogService from '@main/service/InstanceLogService';
import InstanceResourceService from '@main/service/InstanceResourceService';
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
import { Client } from '@main/session';
import { StaticStore } from '@main/util/staticStore';
import { aquire, isBusy, release } from '@universal/util/semaphore';
import { Platform } from '@xmcl/core';
import { Task, TaskHandle } from '@xmcl/task';
import { ipcMain, app } from 'electron';
import { EventEmitter } from 'events';
import { join } from 'path';
import { Manager, Managers } from '.';

// eslint-disable-next-line @typescript-eslint/type-annotation-spacing
type Constructor<T> = new () => T;

interface ServiceCallSession {
    id: number;
    name: string;
    pure: boolean;
    call: () => Promise<any>;
}

export default class ServiceManager extends Manager {
    private registeredServices: Constructor<Service>[] = [];

    private services: Service[] = [];

    private serviceMap: { [name: string]: Service } = {};

    private usedSession = 0;

    private sessions: { [key: number]: ServiceCallSession } = {};

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
        this.registerService(InstanceResourceService);
    }

    protected registerService(s: Constructor<Service>) { this.registeredServices.push(s); }

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

    /**
     * Setup all services.
     */
    setupServices(appData: string, platform: Platform, logger: LoggerFacade, managers: Managers, store: StaticStore<any>, root: string) {
        this.log(`Setup service ${root}`);
        const userPath = join(appData, 'voxelauncher');
        const mcPath = join(appData, platform.name === 'osx' ? 'minecraft' : '.minecraft');

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

        // inject the logger to service prototype
        for (let service of this.registeredServices) {
            const name = service.name;
            Object.defineProperties(service.prototype, {
                log: { value: (m: any, ...a: any[]) => logger.log(`[${name}] ${m}`, ...a) },
                warn: { value: (m: any, ...a: any[]) => logger.warn(`[${name}] ${m}`, ...a) },
                error: { value: (m: any, ...a: any[]) => logger.error(`[${name}] ${m}`, ...a) },
            });
        }

        // create service instance
        let services: Service[] = this.services;
        for (let ServiceConstructor of this.registeredServices) {
            services.push(new ServiceConstructor());
        }

        // register the service to map
        let servMap = this.serviceMap;
        for (let serv of services) {
            let name = Object.getPrototypeOf(serv).constructor.name;
            if (!name) throw new Error('Name of service is undefined');
            servMap[name] = serv;
        }

        /**
         * Inject service dependencies
         */
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

        // check if the service initalize incorrectly.
        for (const s of this.services) {
            for (const key of Object.keys(s)) {
                if (typeof (s as any)[key] === 'undefined') {
                    this.log(`${Object.getPrototypeOf(s).constructor.name}$${key} is undefined!!!`);
                }
            }
        }
    }

    /**
     * Load all the services
     */
    async loadServices() {
        const startingTime = Date.now();
        await Promise.all(this.services.map(s => s.load().catch((e) => {
            this.error(`Error during load service: ${Object.getPrototypeOf(s).constructor.name}`);
            this.error(e);
        })));

        this.log(`Successfully load modules. Total Time is ${Date.now() - startingTime}ms.`);
    }

    /**
     * Initialize all the services
     */
    async initializeService() {
        // wait app ready since in the init stage, the module can access network & others
        const startingTime = Date.now();
        try {
            await Promise.all(this.services.map(s => s.init()));
        } catch (e) {
            this.error('Error during service init:');
            this.error(e);
        }
        this.log(`Successfully init modules. Total Time is ${Date.now() - startingTime}ms.`);
    }

    /**
     * Start the specific service call from its id.
     * @param id The service call session id.
     */
    startServiceCall(id: number) {
        if (!this.sessions[id]) {
            this.error(`Unknown service call session ${id}!`);
        }
        try {
            const r = this.sessions[id].call();
            if (r instanceof Promise) {
                return r.then(r => ({ result: r }), (e) => {
                    this.warn(`Error during service call session ${id}(${this.sessions[id].name}):`);
                    this.warn(e);
                    return { error: e };
                });
            }
            return { result: r };
        } catch (e) {
            this.warn(`Error during service call session ${id}(${this.sessions[id].name}):`);
            this.error(e);
            return { error: e };
        }
    }

    /**
     * Prepare a service call from a client. It will return the service call id.
     * 
     * This will start a session in this manager. 
     * To exectute this service call session, you shoul call `handleSession`
     * 
     * @param client The client calling this service
     * @param service The service name
     * @param name The service function name
     * @param payload The payload
     * @returns The service call session id
     */
    prepareServiceCall(client: Client, service: string, name: string, payload: any): number | undefined {
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
                    client.send(`session-${sessionId}`, handle.root.id);
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
                const sess: ServiceCallSession = {
                    call: () => servProxy[name](payload),
                    name: `${service}.${name}`,
                    pure: false,
                    id: sessionId,
                };

                this.sessions[sessionId] = sess;

                return sessionId;
            }
            this.error(`Cannot execute service call ${name} from service ${serv}. The service doesn't have such method!`);
        }
        return undefined;
    }

    /**
     * Auto save to listen any incoming mutations and call the save function for each services 
     */
    setupAutoSave(store: StaticStore<any>) {
        store!.subscribe((mutation) => {
            this.mutationEventBus.emit(mutation.type, mutation.payload);
            this.services.map(s => s.save({ mutation: mutation.type as any, payload: mutation.payload }));
        });
    }

    // SETUP CODE

    async rootReady() {
        this.setupServices(app.getPath('appData'),
            this.managers.appManager.platform,
            this.managers.logManager,
            this.managers,
            this.managers.storeManager.store!,
            this.managers.appManager.root);
        await this.loadServices();
        this.setupAutoSave(this.managers.storeManager.store!);
        this.managers.storeManager.setLoadDone();
    }

    async appReady() {
        ipcMain.handle('service-call', (e, service: string, name: string, payload: any) => this.prepareServiceCall(e.sender, service, name, payload));
        ipcMain.handle('session', (_, id) => this.startServiceCall(id));
        this.initializeService();
    }
}
