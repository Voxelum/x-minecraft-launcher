import { Task, TaskHandle } from '@xmcl/task';
import { app, ipcMain, webContents } from 'electron';
import { EventEmitter } from 'events';
import AuthLibService from 'main/service/AuthLibService';
import BaseService from 'main/service/BaseService';
import CurseForgeService from 'main/service/CurseForgeService';
import DiagnoseService from 'main/service/DiagnoseService';
import InstanceService from 'main/service/InstanceService';
import JavaService from 'main/service/JavaService';
import LaunchService from 'main/service/LaunchService';
import ResourceService from 'main/service/ResourceService';
import ServerStatusService from 'main/service/ServerStatusService';
import Service, { INJECTIONS_SYMBOL, MUTATION_LISTENERS_SYMBOL } from 'main/service/Service';
import SettingService from 'main/service/SettingService';
import UserService from 'main/service/UserService';
import InstallService from 'main/service/InstallService';
import VersionService from 'main/service/VersionService';
import { platform } from 'main/utils';
import { join } from 'path';
import storeTemplate from 'universal/store';
import Vue from 'vue';
import Vuex, { Store, StoreOptions } from 'vuex';
import { Manager } from '.';

Vue.use(Vuex);

export default class StoreAndServiceManager extends Manager {
    private services: Service[] = [];

    private serviceMap: { [name: string]: Service } = {};

    public store: Store<any> | null = null;

    private usedSession = 0;

    private sessions: { [key: number]: [() => Promise<void>, string] } = {};

    private checkPointId = 0;

    private checkPoint: any;

    private storeReadyCb = () => { };

    private mutationEventBus = new EventEmitter();

    private storeReadyPromise = new Promise((resolve) => {
        this.storeReadyCb = resolve;
    })

    addService(service: Service) {
        this.services.push(service);
    }

    getService<T extends typeof Service>(service: T): InstanceType<T> | undefined {
        return this.serviceMap[service.name] as any;
    }

    setup() {
        ipcMain.handle('sync', (_, id) => this.storeReadyPromise.then(() => this.sync(id)));
    }

    private initServices() {
        this.addService(new AuthLibService());
        this.addService(new CurseForgeService());
        this.addService(new DiagnoseService());
        this.addService(new InstanceService());
        this.addService(new JavaService());
        this.addService(new LaunchService());
        this.addService(new ServerStatusService());
        this.addService(new ResourceService());
        this.addService(new SettingService());
        this.addService(new UserService());
        this.addService(new InstallService());
        this.addService(new VersionService());
        this.addService(new BaseService());
    }

    private setupService(root: string) {
        console.log(`Setup service ${root}`);
        const userPath = app.getPath('userData');
        const managers = this.managers;
        const store = this.store!;
        const mcPath = join(app.getPath('appData'), platform.name === 'osx' ? 'minecraft' : '.minecraft');

        Object.defineProperties(Service.prototype, {
            managers: { value: managers },
            commit: { value: store.commit },
            state: { value: store.state },
            getters: { value: store.getters },
            minecraftPath: { value: mcPath },
            getPath: { value: (...args: string[]) => join(userPath, ...args) },
            getMinecraftPath: { value: (...args: string[]) => join(mcPath, ...args) },
            getGameAssetsPath: { value: (...args: string[]) => join(root, ...args) },
            log: { value: this.managers.LogManager.log },
            warn: { value: this.managers.LogManager.warn },
            error: { value: this.managers.LogManager.error },
        });

        this.initServices();

        const services = this.services;
        const servMap: { [name: string]: Service } = {};
        for (const serv of services) {
            const name = Object.getPrototypeOf(serv).constructor.name;
            if (!name) throw new Error('Name of service is undefined');
            servMap[name] = serv;
        }
        this.serviceMap = servMap;

        for (const serv of services) {
            const injects = Object.getPrototypeOf(serv)[INJECTIONS_SYMBOL] || [];
            for (const i of injects) {
                const { type, field } = i;

                if (type in servMap) {
                    const success = Reflect.set(serv, field, servMap[type]);
                    if (!success) {
                        throw new Error(`Cannot set service ${i} to ${Object.getPrototypeOf(serv)}`);
                    }
                } else {
                    throw new Error(`Cannot find service named ${i}! Which is required by ${Object.getPrototypeOf(serv).constructor.name}`);
                }
            }

            const mutationListeners = Object.getPrototypeOf(serv)[MUTATION_LISTENERS_SYMBOL] || [];
            for (const lis of mutationListeners) {
                this.mutationEventBus.addListener(lis.event, (payload) => lis.listener.apply(serv, [payload]));
            }
        }
    }

    async rootReady(root: string) {
        function deepCopyStoreTemplate(template: StoreOptions<any>) {
            const copy = { ...template };
            if (typeof template.state === 'object') {
                copy.state = JSON.parse(JSON.stringify(template.state));
            }
            if (copy.modules) {
                for (const key of Object.keys(copy.modules)) {
                    copy.modules[key] = deepCopyStoreTemplate(copy.modules[key]);
                }
            }
            return copy;
        }
        const mod = storeTemplate;
        const template = deepCopyStoreTemplate(mod); // deep copy the template so there is no strange reference
        template.state.root = root;
        this.store = new Store(template);
        this.setupService(root);
        this.setupAutoSync();

        for (const s of this.services) {
            for (const key of Object.keys(s)) {
                if (typeof (s as any)[key] === 'undefined') {
                    console.log(`${Object.getPrototypeOf(s).constructor.name}$${key} is undefined!!!`);
                }
            }
        }

        const startingTime = Date.now();
        await Promise.all(this.services.map(s => s.load().catch((e) => {
            console.error(`Error during load service: ${Object.getPrototypeOf(s).constructor.name}`);
            console.error(e);
        })));

        console.log(`Successfully load modules. Total Time is ${Date.now() - startingTime}ms.`);

        this.setupAutoSave();

        this.storeReadyCb();
    }

    async appReady() {
        // wait app ready since in the init stage, the module can access network & others
        const startingTime = Date.now();
        try {
            await Promise.all(this.services.map(s => s.init()));
        } catch (e) {
            console.error('Error during service init:');
            console.error(e);
        }
        console.log(`Successfully init modules. Total Time is ${Date.now() - startingTime}ms.`);
        this.setupReciever();
    }

    private setupReciever() {
        ipcMain.handle('commit', (event, type, payload) => {
            this.store!.commit(type, payload);
        });
        ipcMain.handle('session', (event, id) => {
            if (!this.sessions[id]) {
                console.error(`Unknown session ${id}!`);
            }
            try {
                const r = this.sessions[id][0]();
                if (r instanceof Promise) {
                    return r.then(r => ({ result: r }), (e) => {
                        console.warn(`Error during service call session ${id}(${this.sessions[id][1]}):`);
                        console.warn(e);
                        return { error: e };
                    });
                }
                return { result: r };
            } catch (e) {
                console.error(e);
                return { error: e };
            }
        });
        ipcMain.handle('service-call', (event, service: string, name: string, payload: any) => {
            const serv = this.serviceMap[service];
            if (!serv) {
                console.error(`Cannot execute service call ${name} from service ${service}. The service not found.`);
            } else {
                if (name in serv) {
                    const tasks: TaskHandle<any, any>[] = [];
                    const sessionId = this.usedSession++;
                    const taskManager = this.managers.TaskManager;
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
                console.error(`Cannot execute service call ${name} from service ${serv}. The service doesn't have such method!`);
            }
            return undefined;
        });
    }

    /**
     * Auto save to listen any incoming mutations and call the save function for each services 
     */
    private setupAutoSave() {
        this.store!.subscribe((mutation) => {
            this.mutationEventBus.emit(mutation.type, mutation.payload);
            this.services.map(s => s.save({ mutation: mutation.type as any, payload: mutation.payload }));
        });
    }

    private sync(currentId: number) {
        const checkPointId = this.checkPointId;
        console.log(`Sync from renderer: ${currentId}, main: ${checkPointId}.`);
        if (currentId === checkPointId) {
            return undefined;
        }
        return {
            state: JSON.parse(JSON.stringify(this.checkPoint)),
            length: checkPointId,
        };
    }

    /**
     * Auto sync will watch every mutation and send to each client,
     * and it will response for `sync` channel which will send the mutation histories to the client.
     */
    private setupAutoSync() {
        this.store!.subscribe((mutation, state) => {
            this.checkPoint = state;
            this.checkPointId += 1; // record the total order
            webContents.getAllWebContents().forEach((w) => {
                w.send('commit', mutation, this.checkPointId);
            });
        });
    }
}
