import unknownServer from '@/assets/unknown_server.png';
import { computed, Ref, ref } from '@vue/composition-api';
import { ServerStatusFrame } from '@xmcl/client';
import { useStore } from './useStore';

export function useServer(host: Ref<{ host: string; port: number; protocol?: number }>) {
    const { services } = useStore();
    const status = ref<ServerStatusFrame>({
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
    const pinging = ref(false);
    async function refresh() {
        pinging.value = true;
        status.value = await services.ServerStatusService.pingServer({
            host: host.value.host,
            port: host.value.port,
            protocol: host.value.protocol,
        }).finally(() => {
            pinging.value = false;
        });
    }

    return {
        pinging,
        ...useServerStatus(status),
        refresh,
    };
}

export function useServerStatus(ref?: Ref<ServerStatusFrame | undefined>) {
    const { state, getters, services } = useStore();

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
    const acceptingVersion = computed(() => '[' + getters.getAcceptMinecraftsByProtocol(status.value.version.protocol).join(', ') + ']');

    return {
        acceptingVersion,
        version: computed(() => status.value.version),
        players: computed(() => status.value.players),
        description: computed(() => status.value.description),
        favicon: computed(() => status.value.favicon || unknownServer),
        ping: computed(() => status.value.ping),
        refresh: services.InstanceService.refreshProfile,
    };
}

export function useServerStatusForProfile(id: string) {
    const { state } = useStore();
    return useServerStatus(computed(() => state.profile.statuses[id]));
}
