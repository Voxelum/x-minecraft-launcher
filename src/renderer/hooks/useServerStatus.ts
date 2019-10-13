import { computed, Ref } from '@vue/composition-api';
import { ServerStatusFrame } from '@xmcl/common';
import unknownServer from '@/assets/unknown_server.png';
import { useStore } from './useStore';


export function useServerStatus(ref?: Ref<ServerStatusFrame | undefined>) {
    const { state, dispatch } = useStore();

    const using = ref || computed(() => state.profile.statuses[state.profile.id])
    const status: Ref<ServerStatusFrame> = computed(() => using.value || {
        version: {
            name: '',
            protocol: 0,
        },
        players: {
            max: 0,
            online: 0,
        },
        description: '',
        favicon: '',
        ping: -1,
    });

    async function refresh() {
        await dispatch('refreshProfile');
    }

    return {
        version: computed(() => status.value.version),
        players: computed(() => status.value.players),
        description: computed(() => status.value.description),
        favicon: computed(() => status.value.favicon || unknownServer),
        ping: computed(() => status.value.ping),
        refresh,
    };
}

export function useServerStatusForProfile(id: string) {
    const { state } = useStore();
    return useServerStatus(computed(() => state.profile.statuses[id]));
}
