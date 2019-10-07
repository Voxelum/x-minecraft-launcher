import { Util, Launcher, UserType } from '@xmcl/minecraft-launcher-core';
import { join } from 'path';
import { ipcMain } from 'electron';
import base, { LauncherModule } from 'universal/store/modules/launch';
import { fs } from 'main/utils';

function onerror(e: { message: string; type: string; }) {
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

const mod: LauncherModule = {
    ...base,
    actions: {
        async launch({ state, rootGetters, rootState, commit, dispatch }) {
            try {
                if (state.status !== 'ready' && state.status !== 'error') {
                    return false;
                }

                commit('launchStatus', 'checkingProblems');

                /**
                 * current selected profile
                 */
                const profile = rootGetters.selectedProfile;
                const user = rootGetters.selectedUser;
                const gameProfile = rootGetters.selectedGameProfile;
                if (!profile) {
                    commit('launchErrors', { type: 'selectProfileEmpty', content: [] });
                    return false;
                }
                if (user.accessToken === '' || gameProfile.name === '' || gameProfile.id === '') {
                    commit('launchErrors', { type: 'illegalAuth', content: [] });
                    return false;
                }

                for (let problems = rootGetters.problems.filter(p => p.autofix), i = 0;
                    problems.length !== 0 && i < 1;
                    problems = rootGetters.problems.filter(p => p.autofix), i += 1) {
                    await dispatch('fixProfile', rootGetters.problems.filter(p => !p.optional && p.autofix));
                }

                if (rootGetters.problems.some(p => !p.optional)) {
                    commit('launchErrors', { type: 'unresolvableProblems', content: rootGetters.problems.filter(p => !p.optional) });
                    return false;
                }

                if (state.status === 'ready') { // check if we have cancel (set to ready) this launch
                    return false;
                }

                commit('launchStatus', 'launching');

                const debug = profile.showLog;
                const minecraftFolder = new Util.MinecraftFolder(join(rootState.root, 'profiles', profile.id));

                /**
                 * real version name
                 */
                const version = await dispatch('resolveVersion', {
                    ...profile.version,
                });

                console.log(`Will launch with ${version} version.`);

                const java = profile.java || rootGetters.defaultJava;
                /**
                 * Build launch condition
                 */
                const option: Launcher.Option = {
                    auth: {
                        selectedProfile: gameProfile,
                        accessToken: user.accessToken,
                        userType: UserType.Mojang,
                        properties: {},
                    },
                    gamePath: minecraftFolder.root,
                    resourcePath: rootState.root,
                    javaPath: java.path,
                    minMemory: profile.minMemory,
                    maxMemory: profile.maxMemory,
                    version,
                    extraExecOption: {
                        detached: true,
                        cwd: minecraftFolder.root,
                    },
                    yggdrasilAgent: user.authService !== 'mojang' && user.authService !== 'offline' ? {
                        jar: await dispatch('ensureAuthlibInjection'),
                        server: rootGetters.authService.hostName,
                    } : undefined,
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
                        if (await fs.missing(dir)) {
                            await fs.mkdir(dir);
                        }
                        const files = await fs.readdir(dir);
                        for (const file of files) {
                            const fp = join(dir, file);
                            const isLink = await fs.stat(fp).then(s => s.isSymbolicLink());
                            if (isLink) {
                                await fs.unlink(fp);
                            }
                        }
                        await dispatch('deployResources', {
                            resourceUrls: profile.deployments[domain],
                            profile: profile.id,
                        });
                    } catch (e) {
                        console.error(`Cannot deploy ${domain}`);
                        console.error(e);
                    }
                }

                try {
                    // we link the resource pack whatever 
                    await dispatch('deployResources', {
                        resourceUrls: rootGetters.resourcepacks.map(r => r.hash),
                        profile: profile.id,
                    });
                } catch (e) {
                    console.error('Cannot deploy resource packs');
                    console.error(e);
                }
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
                });
            } catch (e) {
                commit('launchErrors', { type: 'general', content: [e] });
                return false;
            }
        },
    },
};

export default mod;
