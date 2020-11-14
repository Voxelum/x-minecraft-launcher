import { getTsingHuaAdpotOponJDKPageUrl, parseTsingHuaAdpotOpenJDKHotspotArchive } from '@main/entities/java';
import { missing, readdirIfPresent } from '@main/util/fs';
import { unpack7z } from '@main/util/zip';
import { JavaRecord } from '@universal/entities/java';
import { Java, JavaSchema } from '@universal/entities/java.schema';
import { MutationKeys } from '@universal/store';
import { requireString } from '@universal/util/assert';
import { downloadFileTask, JavaInstaller } from '@xmcl/installer';
import { task } from '@xmcl/task';
import { extract } from '@xmcl/unzip';
import { ensureFile, move, readdir, remove, unlink } from 'fs-extra';
import { basename, dirname, join } from 'path';
import Service, { Singleton } from './Service';

export default class JavaService extends Service {
    private javaFile = this.app.platform.name === 'windows' ? 'javaw.exe' : 'java';

    getInternalJavaLocation() {
        return this.app.platform.name === 'osx' ? this.getPath(this.state.root, 'jre', 'Contents', 'Home', 'bin', 'java') : join(this.state.root, 'jre', 'bin', this.javaFile);
    }

    async load() {
        const loaded: JavaSchema = await this.getPersistence({ path: this.getPath('java.json'), schema: JavaSchema });
        const javas = loaded.all.filter(l => typeof l.path === 'string').map(a => ({ ...a, valid: true }));
        this.commit('javaUpdate', javas);
        this.log(`Loaded ${javas.length} java from cache.`);
        if (this.state.java.all.length === 0) {
            await this.refreshLocalJava();
        }
    }

    async init() {
        const { state } = this;
        let local = this.getInternalJavaLocation();
        if (!state.java.all.map(j => j.path).some(p => p === local)) {
            this.resolveJava(local);
        }
        this.refreshLocalJava();
    }

    async save({ mutation }: { mutation: MutationKeys }) {
        switch (mutation) {
            case 'javaUpdate':
            case 'javaRemove':
                this.setPersistence({ path: this.getPath('java.json'), data: this.state.java, schema: JavaSchema });
                break;
            default:
        }
    }

    /**
     * Install a default jdk 8 to the a preserved location. It'll be installed under your launcher root location `jre` folder
     */
    @Singleton('java')
    async installDefaultJava() {
        const task = this.networkManager.isInGFW ? this.installFromTsingHuaTask() : this.installFromMojangTask();
        const handle = this.submit(task);
        await ensureFile(this.getInternalJavaLocation());
        await handle.wait();
        await this.resolveJava(this.getInternalJavaLocation());
    }

    private installFromMojangTask() {
        const dest = dirname(this.getInternalJavaLocation());
        return JavaInstaller.installJreFromMojangTask({
            destination: dest,
            unpackLZMA: unpack7z,
            ...this.networkManager.getDownloaderOption(),
        });
    }

    private installFromTsingHuaTask() {
        return task('installJre', async (c) => {
            const system = this.app.platform.name === 'osx' ? 'mac' as const : this.app.platform.name;
            const arch = this.app.platform.arch === 'x64' ? '64' as const : '32' as const;

            const baseUrl = getTsingHuaAdpotOponJDKPageUrl(system, arch);
            const htmlText = await this.networkManager.request.get(baseUrl).text();
            const archiveInfo = parseTsingHuaAdpotOpenJDKHotspotArchive(htmlText, baseUrl);

            if (!archiveInfo) {
                throw new Error(`Cannot find jre from tsinghua mirror for ${system} x${arch}`);
            }

            const destination = join(this.state.root, 'jre');
            const archivePath = this.getTempPath(archiveInfo.fileName);
            const url = archiveInfo.url;

            this.log(`Install jre for ${system} x${arch} from tsinghua mirror ${url}`);
            await c.execute(task('download', downloadFileTask({
                destination: archivePath,
                url,
            }, this.networkManager.getDownloaderOption())), 90);

            await c.execute(task('decompress', async () => {
                if (system === 'windows') {
                    await extract(archivePath, destination, {
                        entryHandler(_, e) {
                            const [firstDir] = e.fileName.split('/');
                            if (firstDir.startsWith('jdk8u')) {
                                return e.fileName.substring(firstDir.length);
                            }
                            return undefined;
                        },
                    });
                    await unlink(archivePath);
                } else {
                    const tarPath = join(dirname(destination), basename(archivePath, '.gz'));
                    // unpack gz tar to tar
                    await unpack7z(archivePath, dirname(destination));

                    const dirPath = join(dirname(destination), basename(archivePath, '.tar.gz'));
                    // unpack tar to dir
                    await unpack7z(tarPath, dirPath);

                    const files = await readdir(dirPath);
                    if (files[0] && files[0].startsWith('jdk8')) {
                        await move(join(dirPath, files[0]), destination);
                    } else {
                        await move(dirPath, destination);
                    }
                    await Promise.all([remove(dirPath), unlink(tarPath), unlink(archivePath)]);
                }
            }), 10);
            this.log('Install jre for from tsing hua mirror success!');
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
            let commonLocations = [] as string[];
            if (this.app.platform.name === 'windows') {
                let files = await readdirIfPresent('C:\\Program Files\\Java');
                files = files.map(f => join('C:\\Program Files\\Java', f, 'bin', 'java.exe'));
                commonLocations.push(...files);
            }
            let javas = await JavaInstaller.scanLocalJava(commonLocations);
            let infos = javas.map(j => ({ ...j, valid: true }));
            this.log(`Found ${infos.length} java.`);
            this.commit('javaUpdate', infos);
        } else {
            this.log(`Re-validate cached ${this.state.java.all.length} java locations.`);
            let javas: JavaRecord[] = [];
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
                for (let i of javas.filter(j => !j.valid)) {
                    this.log(i.path);
                }
            }
            this.commit('javaUpdate', javas);
        }
    }
}
