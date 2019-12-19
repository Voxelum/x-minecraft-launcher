import { Task } from '@xmcl/minecraft-launcher-core';
import { exec } from 'child_process';
import { fs, installJreFromMojangTask, installJreFromSelfHostTask, platform } from 'main/utils';
import { getPersistence, setPersistence } from 'main/utils/persistence';
import { EOL } from 'os';
import { join } from 'path';
import { MutationKeys } from 'universal/store';
import { Java, JavaSchema } from 'universal/store/modules/java.schema';
import { requireString } from 'universal/utils/object';
import Service, { Singleton } from './Service';

export default class JavaService extends Service {
    private static JAVA_FILE = platform.name === 'windows' ? 'javaw.exe' : 'java';

    async load() {
        const loaded: JavaSchema = await getPersistence({ path: this.getPath('java.json'), schema: JavaSchema });
        if (loaded) {
            this.commit('javaAdd', loaded.all.filter(l => typeof l.path === 'string'));
        }
        if (this.state.java.all.length === 0) {
            await this.refreshLocalJava();
        }
    }

    async init() {
        if (this.state.java.all.length === 0) {
            this.refreshLocalJava();
        } else {
            const local = join(this.state.root, 'jre', 'bin', JavaService.JAVA_FILE);
            if (!this.state.java.all.map(j => j.path).some(p => p === local)) {
                this.resolveJava(local);
            }
            Promise.all(this.state.java.all.map(j => this.resolveJava(j.path)
                .then((result) => { if (!result) { this.commit('javaRemove', j); } })));
        }
    }

    async save({ mutation }: { mutation: MutationKeys }) {
        switch (mutation) {
            case 'javaAdd':
            case 'javaRemove':
            case 'javaSetDefault':
                setPersistence({ path: this.getPath('java.json'), data: this.state.java, schema: JavaSchema });
                break;
            default:
        }
    }

    /**
     * Install a default jdk 8 to the a preserved location. It'll be installed under your launcher root location `jre` folder
     * @param fixing 
     */
    @Singleton('java')
    async installJava(fixing: boolean) {
        const installJre = async (ctx: Task.Context) => {
            const local = join(this.state.root, 'jre', 'bin', JavaService.JAVA_FILE);
            await this.resolveJava(local);
            for (const j of this.state.java.all) {
                if (j.path === local) {
                    console.log(`Found exists installation at ${local}`);
                    return undefined;
                }
            }
            const endpoint = this.managers.NetworkManager.isInGFW ? installJreFromSelfHostTask(this.state.root) : installJreFromMojangTask(this.state.root);

            await endpoint(ctx);
            const java = await this.resolveJava(local);

            if (fixing) {
                // TODO: 
                // await this.profileService.editInstance({ java: java?.majorVersion.toString() });
            }

            return java;
        };
        return this.submit(installJre);
    }

    /**
     * Test if this javapath exist and works
     */
    async resolveJava(javaPath: string): Promise<undefined | Java> {
        requireString(javaPath);
        const exists = await fs.exists(javaPath);
        if (!exists) return undefined;

        // const resolved = this.state.java.all.filter(java => java.path === javaPath)[0];
        // if (resolved) return resolved;

        const getJavaVersion = (str: string) => {
            const match = /(\d+\.\d+\.\d+)(_(\d+))?/.exec(str);
            if (match === null) return undefined;
            return match[1];
        };
        return new Promise((resolve) => {
            exec(`"${javaPath}" -version`, (err, sout, serr) => {
                const version = getJavaVersion(serr);
                if (serr && version !== undefined) {
                    let majorVersion = Number.parseInt(version.split('.')[0], 10);
                    if (majorVersion === 1) {
                        majorVersion = Number.parseInt(version.split('.')[1], 10);
                    }
                    const java = {
                        path: javaPath,
                        version,
                        majorVersion,
                    };
                    this.commit('javaAdd', java);
                    resolve(java);
                } else {
                    resolve(undefined);
                }
            });
            // proc.stderr?.on('data', (chunk) => {
            // console.log(chunk.toString());
            // });
        });
    }

    /**
     * scan local java locations and cache
     */
    @Singleton('java')
    async refreshLocalJava() {
        const unchecked = new Set<string>();

        unchecked.add(join(this.state.root, 'jre', 'bin', JavaService.JAVA_FILE));
        if (process.env.JAVA_HOME) unchecked.add(join(process.env.JAVA_HOME, 'bin', JavaService.JAVA_FILE));

        const which = () => new Promise<string>((resolve) => {
            exec('which java', (error, stdout) => {
                resolve(stdout.replace('\n', ''));
            });
        });
        const where = () => new Promise<string[]>((resolve) => {
            exec('where java', (error, stdout) => {
                resolve(stdout.split('\r\n'));
            });
        });

        if (platform.name === 'windows') {
            const out = await new Promise<string[]>((resolve) => {
                exec('REG QUERY HKEY_LOCAL_MACHINE\\Software\\JavaSoft\\ /s /v JavaHome', (error, stdout) => {
                    if (!stdout) resolve([]);
                    resolve(stdout.split(EOL).map(item => item.replace(/[\r\n]/g, ''))
                        .filter(item => item != null && item !== undefined)
                        .filter(item => item[0] === ' ')
                        .map(item => `${item.split('    ')[3]}\\bin\\javaw.exe`));
                });
            });
            for (const o of [...out, ...await where()]) {
                unchecked.add(o);
            }
        } else if (platform.name === 'osx') {
            unchecked.add('/Library/Internet Plug-Ins/JavaAppletPlugin.plugin/Contents/Home/bin/java');
            unchecked.add(await which());
        } else {
            unchecked.add(await which());
        }

        this.state.java.all.forEach(j => unchecked.add(j.path));

        const checkingList = Array.from(unchecked).filter(jPath => typeof jPath === 'string').filter(p => p !== '');
        console.log(`Checking these location for java ${JSON.stringify(checkingList)}.`);

        await Promise.all(checkingList.map(jPath => this.resolveJava(jPath)));
    }
}
