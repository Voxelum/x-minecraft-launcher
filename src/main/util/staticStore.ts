import { GetterTree, ModuleTree, MutationTree, StoreOptions, MutationPayload } from 'vuex';

type Container = { state?: any; getters?: GetterTree<any, any>; modules?: ModuleTree<any>; mutations?: MutationTree<any> };

function createGetters(rootState: any, rootGetters: GetterTree<any, any>, getters: GetterTree<any, any>, state: any, container: Container) {
    if (container.getters) {
        for (let [key, func] of Object.entries(container.getters)) {
            Object.defineProperty(getters, key, {
                get() { return func(state, getters, rootState, rootGetters); },
                enumerable: true,
            });
            Object.defineProperty(rootGetters, key, {
                get() { return func(state, getters, rootState, rootGetters); },
                enumerable: true,
            });
        }
    }
}
function createMutations(state: any, mutations: Record<string, (payload?: any) => any>, container: Container) {
    if (container.mutations) {
        for (let [key, func] of Object.entries(container.mutations)) {
            mutations[key] = (payload) => func(state, payload);
        }
    }
}
function deepCopy(object: object) {
    return JSON.parse(JSON.stringify(object));
}

type Listener = (mutation: MutationPayload, state: any) => void;

export interface StaticStore<T> {
    state: T;
    getters: Record<string, any>;
    commit: (name: string, payload?: any) => void;
    subscribe: (fn: Listener) => void;
}

export function createStaticStore<T>(template: StoreOptions<T>): StaticStore<T> {
    let subscriptions: Listener[] = [];

    let state = deepCopy(typeof template.state === 'object' ? template.state : template.state());
    let getters: GetterTree<any, any> = {};
    let mutations: Record<string, (payload?: any) => any> = {};
    let subscribe: (fn: Listener) => void = (fn) => {
        subscriptions.push(fn);
    };

    function discover(thisState: any, container: Container) {
        createGetters(state, getters, {}, thisState, container);
        createMutations(thisState, mutations, container);
        if (container.modules) {
            for (let [key, value] of Object.entries(container.modules)) {
                thisState[key] = discover(deepCopy(value.state), value);
            }
        }
        return thisState;
    }
    discover(state, template);

    let commit = (type: string, payload: any) => {
        mutations[type](payload);
        subscriptions.forEach((f) => f({ type, payload }, state));
    };

    return {
        state: state as T,
        getters,
        commit,
        subscribe,
    };
}
