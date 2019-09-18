import { toRefs, Ref, computed } from "@vue/composition-api";
import { useStore } from ".";

import unknownServer from 'renderer/assets/unknown_server.png';
import { ServerStatusFrame } from "@xmcl/common";


export function useSelectedProfileVersion() {
    const store = useStore();
    return toRefs(store.getters.selectedProfile.version);
}

export function useJava() {
    const store = useStore();

    return {
        state: store.state.java,

    }
}

const u = useState<typeof useSelectedProfileVersion>('useSelectedProfileVersion');

export function useState<T extends Function & ((...args: any) => any), K extends T['name'] = T['name']>(use: K): ReturnType<T> {
    return {} as any;
}

interface StateTree {
    [key: string]: Ref<any> | StateTree;
}

interface Store<T extends StateTree> {
    state: T;
}

interface SomeTree extends StateTree {
    a: Ref<string>;
}

let s: Store<SomeTree>;
