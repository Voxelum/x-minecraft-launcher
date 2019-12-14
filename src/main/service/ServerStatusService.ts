import { join } from 'path';
import { fs } from 'main/utils';
import { Server } from '@xmcl/minecraft-launcher-core';
import { createFailureServerStatus } from 'universal/utils/server-status';
import Service from './Service';

export default class ServerStatusService extends Service {
    async load() {
        const protocolFile = this.getPath('protocol.json');
        if (await fs.exists(protocolFile)) {
            const buf = await fs.readFile(protocolFile);
            const object = JSON.parse(buf.toString());
            if (object.eTag) {
                // request server for new one
            }
            const mcversionMapping: any = {};
            for (const [mc, prot] of Object.entries(object.protocol)) {
                if (!mcversionMapping[mc]) mcversionMapping[mc] = [];
                mcversionMapping[mc].push(prot);
            }
            this.commit('protocolMapping', {
                protocol: object.protocol,
                mcversion: mcversionMapping,
            });
        } else {
            const rev = await fs.readFile(join(__static, 'protocol.json'))
                .then(b => b.toString()).then(JSON.parse);
            const forward = await fs.readFile(join(__static, 'mc-protocol.json'))
                .then(b => b.toString()).then(JSON.parse);

            this.commit('protocolMapping', {
                protocol: forward,
                mcversion: rev,
            });
        }
    }

    async pingServer(payload: { host: string; port?: number; protocol?: number }) {
        const { host, port = 25565, protocol } = payload;
        console.log(`Ping server ${host}:${port} with ${protocol}`);
        try {
            return Server.fetchStatusFrame({ host, port }, { protocol });
        } catch (e) {
            switch (e.code) {
                case 'ETIMEOUT':
                    return createFailureServerStatus('server.status.timeout');
                case 'ENOTFOUND':
                    return createFailureServerStatus('server.status.nohost');
                case 'ECONNREFUSED':
                    return createFailureServerStatus('server.status.refuse');
                default:
                    return createFailureServerStatus('server.status.ping');
            }
        }
    }

    async pingServers() {
        const version = this.getters.serverProtocolVersion;
        if (this.state.instance.serverInfos.length > 0) {
            const results = await Promise.all(this.state.instance.serverInfos.map(s => Server.fetchStatusFrame(s, { protocol: version })));
            return results.map((r, i) => ({ status: r, ...this.state.instance.serverInfos[i] }));
        }
        return [];
    }
}
