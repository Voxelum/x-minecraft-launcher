import { computed, Ref, ref } from '@vue/composition-api';
import { ServerStatusFrame } from '@xmcl/minecraft-launcher-core';
import unknownServer from '@/assets/unknown_server.png';
import { useStore } from './useStore';

export function useServerStatus(ref?: Ref<ServerStatusFrame | undefined>) {
    const { state, getters, services } = useStore();

    const using = ref || computed(() => state.instance.statuses[state.instance.id]);
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
    const acceptingVersion = computed(() => `[${getters.getAcceptMinecraftsByProtocol(status.value.version.protocol).join(', ')}]`);

    return {
        acceptingVersion,
        version: computed(() => status.value.version),
        players: computed(() => status.value.players),
        description: computed(() => status.value.description),
        favicon: computed(() => status.value.favicon || unknownServer),
        ping: computed(() => status.value.ping),
        refresh: services.InstanceService.refreshInstance,
    };
}

export function useServerStatusForProfile(id: string) {
    const { state } = useStore();
    return useServerStatus(computed(() => state.instance.statuses[id]));
}

export function useServer(serverRef: Ref<{ host: string; port?: number }>, protocol: Ref<number | undefined>) {
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
    /**
     * Refresh the server status. If the server is empty, it will do nothing.
     */
    async function refresh() {
        pinging.value = true;
        const server = serverRef.value;
        if (!server.host) return;
        status.value = await services.ServerStatusService.pingServer({
            host: server.host,
            port: server.port,
            protocol: protocol.value,
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
