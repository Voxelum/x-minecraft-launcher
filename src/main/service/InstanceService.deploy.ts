import { fs } from 'main/utils';
import { relative } from 'path';
import { DeployedInfo } from 'universal/store/modules/instance.schema';
import { UNKNOWN_RESOURCE } from 'universal/store/modules/resource';
import InstanceService from './InstanceService';

export async function deploy(this: InstanceService, localOnly?: boolean): Promise<void> {
    const instance = this.getters.instance;
    const alreadyDeployed = this.state.instance.deployed;
    const promises: Promise<DeployedInfo>[] = Object.values(instance.deployments).reduce((a, b) => [...a, ...b]).map(async (url) => {
        const alreadyDeployedInfo = alreadyDeployed.find(d => d.url);
        if (alreadyDeployedInfo) {
            if (alreadyDeployedInfo.resolved) {
                return alreadyDeployedInfo;
            }
        }
        const root = this.getPathUnder(this.state.instance.id);
        const result: DeployedInfo = {
            url,
            file: '',
            integrity: '',
            resolved: false,
        };
        let res = this.getters.queryResource(url);
        if (res === UNKNOWN_RESOURCE && !localOnly) {
            res = await this.resource.importResource({ uri: url, metadata: {} });
            console.warn(`No local resource matched uri ${url}!`);
        }
        if (res !== UNKNOWN_RESOURCE) {
            result.src = res.path;
            result.integrity = res.hash;
            if (res.domain === 'mods' || res.domain === 'resourcepacks') {
                const dest = this.getPathUnder(this.state.instance.id, res.domain, res.name + res.ext);
                try {
                    const stat = await fs.lstat(dest);
                    if (stat.isSymbolicLink()) {
                        await fs.unlink(dest);
                        await fs.symlink(res.path, dest);
                    } else {
                        console.error(`Cannot deploy resource ${res.hash} -> ${dest}, since the path is occupied.`);
                    }
                } catch (e) {
                    await fs.symlink(res.path, dest);
                }
                result.file = relative(root, dest);
                result.resolved = 'link';
            } else if (res.domain === 'saves') {
                const dest = await this.importSave(res.path);
                result.file = relative(root, dest);
                result.resolved = 'unpack';
            } else if (res.domain === 'modpacks') { // modpack will override the profile
                await this.importInstanceFromCurseforgeModpack({
                    instanceId: this.state.instance.id,
                    path: res.path,
                });
                result.file = '/';
                result.resolved = 'unpack';
            }
        }
        // TODO: resolve other type of resource
        return result;
    });
    const deployed = await Promise.all(promises);
    this.commit('instanceDeployInfo', deployed);
}
