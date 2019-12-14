import { Server } from '@xmcl/minecraft-launcher-core';
import { InstanceConfig } from 'universal/store/modules/instance.config';
import InstanceService from './InstanceService';

/**
 * Refresh all server status
 */
export async function refreshAll(this: InstanceService) {
    const all: InstanceConfig[] = Object.values(this.state.instance.all).filter(p => !!p.server);
    const results = await Promise.all(all.map(async p => ({ [p.id]: await Server.fetchStatusFrame(p.server!) })));
    this.commit('profileStatus', results.reduce(Object.assign, {}));
}
export async function createProfileFromServer(this: InstanceService, info: Server.Info & { status: Server.StatusFrame }) {
    const options: Partial<InstanceConfig> = {};
    options.name = info.name;
    if (info.status) {
        // if (typeof info.status.description === 'string') {
        //     options.description = info.status.description;
        // } else if (typeof info.status.description === 'object') {
        //     options.description = TextComponent.from(info.status.description).formatted;
        // }
        options.runtime = {
            minecraft: this.state.client.protocolMapping.mcversion[info.status.version.protocol][0],
            forge: '',
            liteloader: '',
        };
        if (info.status.modinfo && info.status.modinfo.type === 'FML') {
            options.deployments = {
                mods: info.status.modinfo.modList.map(m => `forge/${m.modid}/${m.version}`),
            };
        }
    }
    return this.createInstance({
        ...options,
        server: {
            host: info.host,
            port: info.port || 25565,
        },
    });
}
