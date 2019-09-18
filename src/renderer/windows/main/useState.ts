import { toRefs, Ref, computed } from "@vue/composition-api";
import { useStore } from ".";

import unknownServer from 'renderer/assets/unknown_server.png';
import { ServerStatusFrame } from "@xmcl/common";


export function useSelectedProfileVersion() {
    const store = useStore();
    return toRefs(store.getters.selectedProfile.version);
}

export function useServerStatus() {
    const store = useStore();

    const status: Ref<ServerStatusFrame> = computed(() => store.state.profile.status || {
        favicon: unknownServer,
        version: { name: '', protocol: 0 },
        description: '',
        ping: 0,
        players: { max: 0, online: 0 },
    });
    
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
