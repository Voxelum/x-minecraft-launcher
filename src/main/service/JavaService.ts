import { missing } from '@main/util/fs';
import { getTsingHuaMirror } from '@main/util/jreTsingHuaMirror';
import { unpack7z } from '@main/util/zip';
import { MutationKeys } from '@universal/store';
import { JavaState } from '@universal/store/modules/java';
import { Java, JavaSchema } from '@universal/store/modules/java.schema';
import { requireString } from '@universal/util/assert';
import { downloadFileTask, JavaInstaller } from '@xmcl/installer';
import { task } from '@xmcl/task';
import { extract } from '@xmcl/unzip';
import { move, remove, unlink } from 'fs-extra';
import { join } from 'path';
import Service, { Singleton } from './Service';

export default class JavaService extends Service {
    private javaFile = this.appManager.platform.name === 'windows' ? 'javaw.exe' : 'java';

    getInternalJavaLocation() {
        return join(this.state.root, 'jre', 'bin', this.javaFile);
    }

    async load() {
        let loaded: JavaSchema = await this.getPersistence({ path: this.getPath('java.json'), schema: JavaSchema });
        let javas = loaded.all.filter(l => typeof l.path === 'string').map(a => ({ ...a, valid: true }));
        this.commit('javaUpdate', javas);
        this.log(`Loaded ${javas.length} java from cache.`);
        if (this.state.java.all.length === 0) {
            await this.refreshLocalJava();
        }
    }

    async init() {
        const { state } = this;
        if (state.java.all.length === 0) {
            this.refreshLocalJava();
        } else {
            let local = this.getInternalJavaLocation();
            if (!state.java.all.map(j => j.path).some(p => p === local)) {
                this.resolveJava(local);
            }
        }
    }

    async save({ mutation }: { mutation: MutationKeys }) {
        switch (mutation) {
            case 'javaUpdate':
            case 'javaRemove':
            case 'javaSetDefault':
                this.setPersistence({ path: this.getPath('java.json'), data: this.state.java, schema: JavaSchema });
                break;
            default:
        }
    }

    /**
     * Install a default jdk 8 to the a preserved location. It'll be installed under your launcher root location `jre` folder
     */
    @Singleton('java')
    async installJava() {
        let task = this.networkManager.isInGFW ? this.installFromTsingHuaTask() : this.installFromMojangTask();
        let handle = this.submit(task);
        await handle.wait();
        await this.resolveJava(this.getInternalJavaLocation());
    }

    private installFromMojangTask() {
        let dest = this.getInternalJavaLocation();
        return JavaInstaller.installJreFromMojangTask({
            destination: dest,
            unpackLZMA: unpack7z,
            ...this.networkManager.getDownloaderOption(),
        });
    }

    private installFromTsingHuaTask() {
        return task('installJre', async (c) => {
            let system = this.appManager.platform.name === 'osx' ? 'mac' as const : this.appManager.platform.name;
            let arch = this.appManager.platform.arch === 'x64' ? '64' as const : '32' as const;
            let [url, sha256Url] = getTsingHuaMirror(system, arch);
            let sha256 = await this.networkManager.request(sha256Url).text();
            sha256 = sha256.split(' ')[0];
            let dest = join(this.state.root, 'jre');
            let tempZip = join(this.state.root, 'temp', 'java-temp');
            await c.execute(task('download', downloadFileTask({
                destination: tempZip,
                url,
                checksum: {
                    algorithm: 'sha256',
                    hash: sha256,
                },
            }, this.networkManager.getDownloaderOption())), 90);

            await c.execute(task('decompress', async () => {
                if (system === 'windows') {
                    await extract(tempZip, dest, {
                        entryHandler(_, e) {
                            return e.fileName.substring('jdk8u242-b08-jre'.length);
                        },
                    });
                } else {
                    let tempTar = join(this.state.root, 'temp', 'java-temp.tar');
                    await unpack7z(tempZip, tempTar);
                    await unpack7z(tempTar, join(this.state.root, 'temp'));
                    await move(join(this.state.root, 'temp', 'jdk8u242-b08-jre'), dest);
                    await remove(join(this.state.root, 'temp', 'jdk8u242-b08-jre'));
                    await unlink(tempTar);
                }
                await unlink(tempZip);
            }), 10);
        });
    }

    /**
     * Resolve java info. If the java is not known by launcher. It will cache it into the launcher java list.
     */
    async resolveJava(javaPath: string): Promise<undefined | Java> {
        requireString(javaPath);

        let found = this.state.java.all.find(java => java.path === javaPath);
        if (found) {
            return found;
        }

        if (await missing(javaPath)) return undefined;

        let java = await JavaInstaller.resolveJava(javaPath);
        if (java) {
            this.commit('javaUpdate', { ...java, valid: true });
        }
        return java;
    }

    /**
     * scan local java locations and cache
     */
    @Singleton('java')
    async refreshLocalJava() {
        if (this.state.java.all.length === 0) {
            this.log('No local cache found. Scan java through the disk.');
            let javas = await JavaInstaller.scanLocalJava([]);
            let infos = javas.map(j => ({ ...j, valid: true }));
            this.log(`Found ${infos.length} java.`);
            this.commit('javaUpdate', infos);
        } else {
            this.log(`Re-validate cached ${this.state.java.all.length} java locations.`);
            let javas: JavaState[] = [];
            for (let i = 0; i < this.state.java.all.length; ++i) {
                let result = await JavaInstaller.resolveJava(this.state.java.all[i].path);
                if (result) {
                    javas.push({ ...result, valid: true });
                } else {
                    javas.push({ ...this.state.java.all[i], valid: false });
                }
            }
            let invalided = javas.filter(j => !j.valid).length;
            if (invalided !== 0) {
                this.log(`Invalidate ${invalided} java!`);
            }
            this.commit('javaUpdate', javas);
        }
    }
}
