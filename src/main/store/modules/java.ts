import { Task } from '@xmcl/minecraft-launcher-core';
import { exec } from 'child_process';
import { fs, installJreFromMojang, platform, installJreFromSelfHost, gfw } from 'main/utils';
import { EOL } from 'os';
import { join } from 'path';
import base, { JavaModule } from 'universal/store/modules/java';
import { JavaConfig } from 'universal/store/modules/java.config';
import { requireString } from 'universal/utils/object';

const JAVA_FILE = platform.name === 'windows' ? 'javaw.exe' : 'java';

const mod: JavaModule = {
    ...base,
    actions: {
        async load(context) {
            const loaded: JavaConfig = await context.dispatch('getPersistence', { path: 'java.json', schema: 'JavaConfig' });
            if (loaded) {
                context.commit('addJava', loaded.all.filter(l => typeof l.path === 'string'));
            }
            if (context.state.all.length === 0) {
                await context.dispatch('refreshLocalJava');
            }
        },
        async init(context) {
            if (context.state.all.length === 0) {
                context.dispatch('refreshLocalJava');
            } else {
                const local = join(context.rootState.root, 'jre', 'bin', JAVA_FILE);
                if (!context.state.all.map(j => j.path).some(p => p === local)) {
                    context.dispatch('resolveJava', local);
                }
                Promise.all(context.state.all.map(j => context.dispatch('resolveJava', j.path)
                    .then((result) => { if (!result) { context.commit('removeJava', j); } })));
            }
        },
        async save(context, { mutation }) {
            switch (mutation) {
                case 'addJava':
                case 'removeJava':
                case 'defaultJava':
                    await context.dispatch('setPersistence', { path: 'java.json', data: context.state });
                    break;
                default:
            }
        },
        async installJava(context, fixing) {
            const task = Task.create('installJre', async (ctx) => {
                context.commit('aquireProfile');

                const local = join(context.rootState.root, 'jre', 'bin', JAVA_FILE);
                await context.dispatch('resolveJava', local);
                for (const j of context.state.all) {
                    if (j.path === local) {
                        context.commit('releaseProfile');
                        console.log(`Found exists installation at ${local}`);
                        return undefined;
                    }
                }
                const endpoint = await gfw() ? installJreFromSelfHost : installJreFromMojang;
                // const endpoint = officialEndpoint;

                await endpoint(ctx);
                const java = await context.dispatch('resolveJava', local);

                if (fixing) {
                    await context.dispatch('editProfile', { java });
                }

                context.commit('releaseProfile');
                return java;
            });
            return context.dispatch('executeTask', task);
        },
        /**
         * Test if this javapath exist and works
         */
        async resolveJava(context, javaPath) {
            requireString(javaPath);
            const exists = await fs.exists(javaPath);
            if (!exists) return undefined;

            // const resolved = context.state.all.filter(java => java.path === javaPath)[0];
            // if (resolved) return resolved;

            const getJavaVersion = (str: string) => {
                const match = /(\d+\.\d+\.\d+)(_(\d+))?/.exec(str);
                if (match === null) return undefined;
                return match[1];
            };
            return new Promise((resolve, reject) => {
                const proc = exec(`"${javaPath}" -version`, (err, sout, serr) => {
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
                        context.commit('addJava', java);
                        resolve(java);
                    } else {
                        resolve(undefined);
                    }
                });
                proc.stderr.on('data', (chunk) => {
                    // console.log(chunk.toString());
                });
            });
        },
        /**
         * scan local java locations and cache
         */
        async refreshLocalJava({ state, dispatch, commit, rootState }) {
            commit('aquireProfile');
            try {
                const unchecked = new Set<string>();

                unchecked.add(join(rootState.root, 'jre', 'bin', JAVA_FILE));
                if (process.env.JAVA_HOME) unchecked.add(join(process.env.JAVA_HOME, 'bin', JAVA_FILE));

                const which = () => new Promise<string>((resolve, reject) => {
                    exec('which java', (error, stdout, stderr) => {
                        resolve(stdout.replace('\n', ''));
                    });
                });
                const where = () => new Promise<string[]>((resolve, reject) => {
                    exec('where java', (error, stdout, stderr) => {
                        resolve(stdout.split('\r\n'));
                    });
                });

                if (platform.name === 'windows') {
                    const out = await new Promise<string[]>((resolve, reject) => {
                        exec('REG QUERY HKEY_LOCAL_MACHINE\\Software\\JavaSoft\\ /s /v JavaHome', (error, stdout, stderr) => {
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

                state.all.forEach(j => unchecked.add(j.path));

                const checkingList = Array.from(unchecked).filter(jPath => typeof jPath === 'string').filter(p => p !== '');
                console.log(`Checking these location for java ${JSON.stringify(checkingList)}.`);

                await Promise.all(checkingList.map(jPath => dispatch('resolveJava', jPath)));
            } finally {
                commit('releaseProfile');
            }
        },
    },
};

export default mod;
