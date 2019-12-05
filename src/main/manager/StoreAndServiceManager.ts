import { Task, TaskHandle } from "@xmcl/minecraft-launcher-core";
import { App, ipcMain, webContents } from "electron";
import AuthLibService from "main/service/AuthLibService";
import CurseForgService from "main/service/CurseForgeService";
import DiagnoseService from "main/service/DiagnoseService";
import InstanceService from "main/service/InstanceService";
import JavaService from "main/service/JavaService";
import LauncheService from "main/service/LauncheService";
import ResourceService from "main/service/ResourceService";
import ServerStatusService from "main/service/ServerStatusService";
import Service from "main/service/Service";
import SettingService from "main/service/SettingService";
import UserService from "main/service/UserService";
import VersionInstallService from "main/service/VersionInstallService";
import VersionService from "main/service/VersionService";
import { platform } from "main/utils";
import { join } from "path";
import modules from 'universal/store/modules';
import Vue from "vue";
import Vuex, { MutationPayload, Store, StoreOptions } from "vuex";
import { Manager } from ".";

Vue.use(Vuex);

export default class StoreAndServiceManager extends Manager {
    private services: Service[] = [];
    private serviceMap: { [name: string]: Service } = {};
    public store: Store<any> | null = null;
    private usedSession: number = 0;
    private sessions: { [key: number]: () => Promise<void> } = {};

    constructor() {
        super();
        this.addService(new AuthLibService());
        this.addService(new CurseForgService());
        this.addService(new DiagnoseService());
        this.addService(new InstanceService());
        this.addService(new JavaService());
        this.addService(new LauncheService());
        this.addService(new ServerStatusService());
        this.addService(new ResourceService());
        this.addService(new SettingService());
        this.addService(new UserService());
        this.addService(new VersionInstallService());
        this.addService(new VersionService());
    }

    addService(service: Service) {
        this.services.push(service);
    }

    getService<T extends typeof Service>(service: T): InstanceType<T> | undefined {
        return this.serviceMap[service.name] as any;
    }

    private setupService(root: string) {
        console.log(`Setup service ${root}`);
        const store = this.store!;
        const services = this.services
        const servMap: { [name: string]: Service } = {};
        const getPath = (...paths: string[]) => join(root, ...paths);
        for (const serv of services) {
            const name = Object.getPrototypeOf(serv).constructor.name;
            if (!name) throw new Error('Name of service is undefined')
            servMap[name] = serv;
            const anySeriv = serv as any;
            anySeriv.managers = this.managers;
            anySeriv.commit = store.commit;
            anySeriv.state = store.state;
            anySeriv.getters = store.getters;
            anySeriv.getPath = getPath;
        }
        this.serviceMap = servMap;

        for (const serv of services) {
            const injects = Object.getPrototypeOf(serv).injections || [];
            for (const i of injects) {
                const { type, field } = i;

                if (type in servMap) {
                    const success = Reflect.set(serv, field, servMap[type]);
                    if (!success) {
                        throw new Error(`Cannot set service ${i} to ${Object.getPrototypeOf(serv)}`)
                    }
                } else {
                    throw new Error(`Cannot find service named ${i}! Which is required by ${Object.getPrototypeOf(serv).constructor.name}`);
                }
            }
        }
    }

    async rootReady(root: string) {
        ipcMain.removeAllListeners('vuex-sync');
        function deepCopyStoreTemplate(template: typeof mod) {
            const copy = Object.assign({}, template);
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
        const mod: StoreOptions<any> = {
            state: {
                root,
                platform,
                online: false,
                semaphore: {},
            },
            modules,
            getters: {
                busy(state) { return (key: string) => state.semaphore[key] === 0; }
            },
            mutations: {
                platform(state, p) { state.platform = p; },
                online(state, o) { state.online = o; },
                root(state, r) { state.root = r; },
                aquire(state, res) {
                    const sem = res instanceof Array ? res : [res];
                    for (const s of sem) {
                        if (s in state) { state.semaphore[s] += 1; }
                        else { Vue.set(state.semaphore, s, 1); }
                    }
                },
                release(state, res) {
                    const sem = res instanceof Array ? res : [res];
                    for (const s of sem) {
                        if (s in state) { state.semaphore[s] -= 1; }
                    }
                }
            },
            strict: process.env.NODE_ENV !== 'production',
        };
        const template = deepCopyStoreTemplate(mod); // deep copy the template so there is no strange reference
        this.store = new Store(template);
        this.setupService(root);
        this.setupAutoSync();

        for (const s of this.services) {
            for (const key of Object.keys(s)) {
                if (typeof (s as any)[key] === 'undefined') {
                    console.log(`${Object.getPrototypeOf(s).constructor.name}$${key} is undefined!!!`)
                }
            }
        }
        let startingTime = Date.now();
        try {
            await Promise.all(this.services.map(s => s.load()));
        } catch (e) {
            console.error(e);
        }
        console.log(`Successfully load modules. Total Time is ${Date.now() - startingTime}ms.`);

        this.setupAutoSave();

        console.log('StoreDone')
    }

    async appReady(app: App) {
        // wait app ready since in the init stage, the module can access network & others
        let startingTime = Date.now();
        try {
            await Promise.all(this.services.map(s => s.init()));
        } catch (e) {
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
            return this.sessions[id]();
        });
        ipcMain.handle('service-call', (event, service: string, name: string, payload: any) => {
            const serv = this.serviceMap[service];
            if (!serv) {
                console.error(`Cannot execute service call ${name} from service ${serv}. The service not found.`);
            } else {
                if (name in serv) {
                    let tasks: TaskHandle<any, any>[] = [];
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
                        }
                    });

                    this.sessions[sessionId] = () => servProxy[name](payload);

                    return sessionId;
                } else {
                    console.error(`Cannot execute service call ${name} from service ${serv}. The service doesn't have such method!`);
                }
            }
        });
    }

    /**
     * Auto save to listen any incoming mutations and call the save function for each services 
     */
    private setupAutoSave() {
        this.store!.subscribe((mutation) => {
            this.services.map(s => s.save({ mutation: mutation.type, payload: mutation.payload }))
        });
    }

    /**
     * Auto sync will watch every mutation and send to each client,
     * and it will response for `sync` channel which will send the mutation histories to the client.
     */
    private setupAutoSync() {
        const mutationHistory: MutationPayload[] = [];
        ipcMain.handle('sync', (event, currentId) => {
            console.log(`sync on renderer: ${currentId}, main: ${mutationHistory.length}`);
            if (currentId === mutationHistory.length) {
                return;
            }
            const mutations = mutationHistory.slice(currentId);
            return {
                mutations,
                length: mutationHistory.length
            }
        });
        this.store!.subscribe((mutation, state) => {
            mutationHistory.push(mutation);
            const id = mutationHistory.length;
            webContents.getAllWebContents().forEach((w) => {
                w.send('commit', mutation, id);
            });
        });
    }
}
