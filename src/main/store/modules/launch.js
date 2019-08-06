import { MinecraftFolder, Launcher } from 'ts-minecraft';
import paths, { join } from 'path';
import { ipcMain } from 'electron';
import base from 'universal/store/modules/launch';
import { existsSync, mkdirSync, promises } from 'fs';

/**
 * @param {{ message: string; type: string; }} e
 */
function onerror(e) {
    if (e.message.startsWith('Cannot find version ') || e.message.startsWith('No version file for ') || e.message.startsWith('No version jar for ')) {
        e.type = 'missing.version';
    } else if (e.message === 'Missing library') {
        e.type = 'missing.libraries';
    } else if (e.message === 'Missing asset!') {
        e.type = 'missing.assets';
    } else if (e.message === 'Missing mainClass' || e.message === 'Missing minecraftArguments') {
        e.type = 'illegal.version.json';
    }
    return e;
}

/**
 * @type { import('universal/store/modules/launch').LauncherModule }
 */
const mod = {
    ...base,
    actions: {
        async launch({ state, rootGetters, rootState, commit, dispatch }) {
            if (state.status !== 'ready') {
                return false;
            }
            /**
             * current selected profile
             */
            const profile = rootGetters.selectedProfile;
            const user = rootState.user;
            if (!profile) return Promise.reject(new Error('launch.profile.empty'));
            if (user.accessToken === '' || user.name === '' || user.id === '') return Promise.reject(new Error('launch.auth.illegal'));

            commit('launchStatus', 'checkingProblems');
            for (let problems = rootState.profile.problems.filter(p => p.autofix);
                problems.length !== 0;
                problems = rootState.profile.problems.filter(p => p.autofix)) {
                await dispatch('fixProfile', problems);
            }

            if (rootState.profile.problems.some(p => !p.optional)) {
                commit('launchStatus', 'ready');
                return false;
            }

            if (state.status === 'ready') { // check if we have cancel (set to ready) this launch
                return false;
            }

            commit('launchStatus', 'launching');

            const debug = profile.showLog;
            const minecraftFolder = new MinecraftFolder(paths.join(rootState.root, 'profiles', profile.id));

            /**
             * real version name
             */
            const version = await dispatch('resolveVersion', {
                folder: '',
                ...profile.version,
            });

            console.log(`Will launch with ${version} version.`);

            const java = profile.java || rootGetters.defaultJava;
            /**
             * Build launch condition
             * @type {Launcher.Option}
             */
            const option = {
                auth: {
                    selectedProfile: {
                        id: user.id,
                        name: user.name,
                    },
                    accessToken: user.accessToken,
                    userType: user.userType,
                    properties: user.properties,
                },
                gamePath: minecraftFolder.root,
                resourcePath: rootState.root,
                javaPath: java.path,
                minMemory: profile.minMemory,
                maxMemory: profile.maxMemory,
                version,
                extraExecOption: {
                    detached: true,
                },
            };

            console.log('Launching a server');
            if (profile.type === 'server') {
                option.server = { ip: profile.host, port: profile.port };
            }

            console.log('Deploy all resources...');
            for (const domain of Object.keys(profile.deployments)) {
                try {
                    console.log(`Deploying ${profile.deployments[domain].length} resources for ${domain}`);
                    const dir = join(option.gamePath, domain);
                    if (!existsSync(dir)) {
                        mkdirSync(dir);
                    }
                    const files = await promises.readdir(dir);
                    await Promise.all(files.map(file => promises.unlink(join(dir, file))));
                    await dispatch('deployResources', {
                        resourceUrls: profile.deployments[domain],
                        profile: profile.id,
                    });
                } catch (e) {
                    console.error(`Cannot deploy ${domain}`);
                    console.error(e);
                }
            }

            // we link the resource pack whatever 
            await dispatch('deployResources', {
                resourceUrls: rootGetters.resourcepacks.map(r => r.hash),
                profile: profile.id,
            });

            console.log('Launching with these option...');
            console.log(JSON.stringify(option));

            // Launch
            return Launcher.launch(option).then((process) => {
                commit('launchStatus', 'launched');
                let crashReport = '';
                let crashReportLocation = '';
                let waitForReady = true;
                ipcMain.emit('minecraft-start', debug);
                process.on('error', (err) => {
                    console.log(err);
                });
                process.on('exit', (code, signal) => {
                    console.log(`exit: ${code}, signal: ${signal}`);
                    if (signal === 'SIGKILL') {
                        ipcMain.emit('minecraft-killed');
                    }
                    if (code !== 0 && (crashReport || crashReportLocation)) {
                        ipcMain.emit('minecraft-crash-report', {
                            crashReport,
                            crashReportLocation,
                        });
                        ipcMain.emit('minecraft-exit', {
                            code,
                            signal,
                            crashReport,
                            crashReportLocation,
                        });
                    } else {
                        ipcMain.emit('minecraft-exit', { code, signal });
                    }
                    commit('launchStatus', 'ready');
                });
                process.stdout.on('data', (s) => {
                    const string = s.toString();
                    if (string.indexOf('---- Minecraft Crash Report ----') !== -1) {
                        crashReport = string;
                    } else if (string.indexOf('Crash report saved to:') !== -1) {
                        crashReportLocation = string.substring(string.indexOf('Crash report saved to:') + 'Crash report saved to: #@!@# '.length);
                    } else if (waitForReady && string.indexOf('Reloading ResourceManager') !== -1 || string.indexOf('LWJGL Version: ') !== -1) {
                        waitForReady = false;
                        ipcMain.emit('minecraft-window-ready');
                        commit('launchStatus', 'minecraftReady');
                    }
                    ipcMain.emit('minecraft-stdout', string);
                });
                process.stderr.on('data', (s) => {
                    ipcMain.emit('minecraft-stderr', s.toString());
                });
                process.unref();
                return true;
            }).catch((e) => {
                throw (e);
            });
        },
    },
};

export default mod;
