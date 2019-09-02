import { Store, DispatchOptions, MutationTree, ActionTree, Module as VModule, Action } from 'vuex'
import { RendererInterface, Remote } from 'electron';

import { UserModule } from './modules/user'
import { VersionModule } from './modules/version'
import { ProfileModule, CreateOption } from './modules/profile';
import { JavaModule } from './modules/java';
import { CurseForgeModule } from './modules/curseforge';
import { ResourceModule, Resource } from './modules/resource'
import { TaskModule } from './modules/task';
import { DiagnoseModule } from './modules/diagnose';
import { SettingModule } from './modules/setting';
import { IOModule, Actions as IOActions } from './modules/io';
import { LauncherModule, State as LaunchState, Mutations as LaunchMutations } from './modules/launch';
import { ClientModule } from './modules/client';

export type TaskHandle = string;

type C = Context<BaseState, BaseGetters, BaseMutations, BaseActions>
interface BaseActions {
    showItemInFolder(context: C, item: string): Promise<void>;
    openItem(context: C, item: string): Promise<void>;
}
interface BaseGetters {
    /**
     * @returns the path relate to the launcher root data folder
     */
    path: (...args: string[]) => string
}

interface BaseState {
    /**
     * launcher root data folder path
     */
    root: string
    online: boolean
    platform: NodeJS.Platform
}
interface BaseMutations {
    root(state: BaseState, root: string): void
    online(state: BaseState, online: boolean): void
    platform(state: BaseState, platform: NodeJS.Platform): void
}

type AllModules = VersionModule | ProfileModule | JavaModule | ResourceModule | TaskModule | SettingModule | UserModule | LauncherModule | IOModule | DiagnoseModule | CurseForgeModule | ClientModule; 
type ModulesIntersection = VersionModule & ProfileModule & JavaModule & ResourceModule & TaskModule & SettingModule & UserModule & LauncherModule & IOModule & DiagnoseModule & CurseForgeModule & ClientModule;
interface ModulesCollection extends ModulesIntersection { }

type Mutations =
    Required<ModulesCollection>["mutations"] &
    BaseMutations;

type Actions =
    Required<ModulesCollection>["actions"] &
    BaseActions;

type RootDispatch = Dispatch<Actions> & {
    (action: 'save', payload: { mutation: keyof Mutations, payload?: any }): Promise<void>;
}
type RootCommit = Commit<Mutations>;

type AllGetters = UseGetters<Required<ModulesCollection>["getters"]> & BaseGetters;

interface RootGetters extends AllGetters { }

type SaveFunction<C> = (context: C, payload: { mutation: keyof Mutations, payload: any }) => Promise<void>;
type LoadFunction<C> = (context: C) => Promise<void>;

interface Repo extends Store<RootState> {
    commit: RootCommit;
    dispatch: RootDispatch;
    getters: RootGetters;
}

declare module "vue/types/vue" {
    interface Vue {
        $repo: Repo
        $electron: RendererInterface
    }
}

type ObjectWithFunctions<T> = {
    [K in keyof T]: (...args: any) => any;
};

interface Commit<MU extends ObjectWithFunctions<MU>> {
    <T extends keyof MU>(type: T, payload?: Parameters<MU[T]>[1]): void;
}

interface Dispatch<AC extends ObjectWithFunctions<AC>> {
    <T extends keyof AC>(type: T, payload?: Parameters<AC[T]>[1]): ReturnType<AC[T]>;
}

type UseGetters<GetterTree extends ObjectWithFunctions<GetterTree>> = {
    [K in keyof GetterTree]: ReturnType<GetterTree[K]>
}

interface Context<S, G, M extends ObjectWithFunctions<M>, A extends ObjectWithFunctions<A>> {
    state: S; dispatch: RootDispatch & Dispatch<A>; commit: Commit<M> & RootCommit, rootGetters: RootGetters, getters: G, rootState: RootState;
}

type GetterTree<S, G> = {
    [P in keyof G]: (state: S, getters: G, rootState: RootState, rootGetters: RootGetters) => G[P];
}

interface Module<N, S, G, M extends ObjectWithFunctions<M>, A extends ObjectWithFunctions<A>> {
    name?: N;
    state?: S;
    mutations?: M;
    actions?: A & {
        load?: LoadFunction<Context<S, G, M, A>>
        save?: SaveFunction<Context<S, G, M, A>>
        init?: LoadFunction<Context<S, G, M, A>>
    };
    getters?: GetterTree<S, G>;
}

type StateTree = {
    [K in Required<AllModules>["name"]]: Extract<Required<AllModules>, { name: K }>["state"]
} & BaseState;

interface RootState extends StateTree {
}
