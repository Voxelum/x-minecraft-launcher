import { computed, Ref } from '@vue/composition-api';
import { ServerStatusFrame } from '@xmcl/common';
import unknownServer from '@/assets/unknown_server.png';
import { useStore } from './useStore';

export function useServerStatus() {
    const { state } = useStore();
    const status: Ref<ServerStatusFrame> = computed(() => state.profile.status || {
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

    return {
        version: computed(() => status.value.version),
        players: computed(() => status.value.players),
        description: computed(() => status.value.description),
        favicon: computed(() => status.value.favicon || unknownServer),
        ping: computed(() => status.value.ping),
    };
}