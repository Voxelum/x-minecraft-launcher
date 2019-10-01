
import { RendererInterface } from 'electron';
import Vue from 'vue';
import Vuex, { Store, StoreOptions } from 'vuex';
import modules from './modules';
import { ClientModule } from './modules/client';
import { CurseForgeModule } from './modules/curseforge';
import { DiagnoseModule } from './modules/diagnose';
import { IOModule } from './modules/io';
import { JavaModule } from './modules/java';
import { LauncherModule } from './modules/launch';
import { ProfileModule } from './modules/profile';
import { ResourceModule } from './modules/resource';
import { SettingModule } from './modules/setting';
import { TaskModule } from './modules/task';
import { UserModule } from './modules/user';
import { VersionModule } from './modules/version';

Vue.use(Vuex);

export interface BaseState {
    /**
     * launcher root data folder path
     */
    root: string
    online: boolean
    platform: NodeJS.Platform
}
export interface BaseGetters {
    /**
     * @returns the path relate to the launcher root data folder
     */
    path: (...args: string[]) => string
}
export interface BaseMutations {
    root(state: BaseState, root: string): void
    online(state: BaseState, online: boolean): void
    platform(state: BaseState, platform: NodeJS.Platform): void
}
export interface BaseActions {
    showItemInFolder(context: Context<BaseState, BaseGetters>, item: string): Promise<void>;
    openItem(context: Context<BaseState, BaseGetters>, item: string): Promise<void>;
}

export interface RootModule extends Module<'', BaseState, BaseGetters, BaseMutations, BaseActions> {
    modules: any
    strict: boolean
}

export default {
    state: {
        root: '',
        online: false,
        platform: 'win32',
    },
    modules,
    mutations: {
        online(state, o) { state.online = o; },
        root(state, r) { state.root = r; },
        platform(state, p) { state.platform = p; },
    },
    getters: {},
    strict: process.env.NODE_ENV !== 'production',
} as StoreOptions<BaseState>;


type SaveFunction<C> = (context: C, payload: { mutation: keyof Mutations, payload: any }) => Promise<void>;
type LoadFunction<C> = (context: C) => Promise<void>;
type AllModules = VersionModule | ProfileModule | JavaModule | ResourceModule | TaskModule | SettingModule | UserModule | LauncherModule | IOModule | DiagnoseModule | CurseForgeModule | ClientModule;
type ModulesIntersection = VersionModule & ProfileModule & JavaModule & ResourceModule & TaskModule & SettingModule & UserModule & LauncherModule & IOModule & DiagnoseModule & CurseForgeModule & ClientModule;
export type Mutations =
    Required<ModulesIntersection>["mutations"] &
    BaseMutations;
export type Actions =
    Required<ModulesIntersection>["actions"] &
    BaseActions;
// type AllGetters = UseGetters<Required<ModulesCollection>["getters"]> & BaseGetters;


type ObjectWithFunctions<T> = {
    [K in keyof T]: (...args: any) => any;
};
type UseGetters<GetterTree extends ObjectWithFunctions<GetterTree>> = {
    [K in keyof GetterTree]: ReturnType<GetterTree[K]>
}
type GetterTree<S, G> = {
    [P in keyof G]: (state: S, getters: G, rootState: RootState, rootGetters: RootGetters) => G[P];
}
type StateTree = BaseState & {
    [K in Required<AllModules>["name"]]: Extract<Required<AllModules>, { name: K }>["state"]
};


export interface RootState extends StateTree {}
export interface RootGetters extends UseGetters<Required<ModulesIntersection>["getters"]>, BaseGetters { }
export interface RootCommit extends Commit<Mutations> {}
export interface RootDispatch extends Dispatch<Actions> {
    (action: 'save', payload: { mutation: keyof Mutations, payload?: any }): Promise<void>;
};

export interface Commit<MU extends ObjectWithFunctions<MU>> {
    <T extends keyof MU>(type: T, payload?: Parameters<MU[T]>[1]): void;
}
export interface Dispatch<AC extends ObjectWithFunctions<AC>> {
    <T extends keyof AC>(type: T, payload?: Parameters<AC[T]>[1]): ReturnType<AC[T]>;
}
export interface Context<S, G> {
    state: S;
    getters: G;
    commit: RootCommit;
    dispatch: RootDispatch;
    rootGetters: RootGetters;
    rootState: RootState;
}
export interface Module<N, S, G, M extends ObjectWithFunctions<M>, A extends ObjectWithFunctions<A>> {
    name?: N;
    state?: S;
    getters?: GetterTree<S, G>;
    mutations?: M;
    actions?: A & {
        load?: LoadFunction<Context<S, G>>
        save?: SaveFunction<Context<S, G>>
        init?: LoadFunction<Context<S, G>>
    };
}
export interface Repo extends Store<RootState> {
    commit: RootCommit;
    dispatch: RootDispatch;
    getters: RootGetters;
}

declare module "vue/types/vue" {
    interface Vue {
        $repo: Repo;
        $electron: RendererInterface;
    }
}
