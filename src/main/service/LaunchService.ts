import { Launcher, Util } from '@xmcl/minecraft-launcher-core';
import { join } from 'path';
import AuthLibService from './AuthLibService';
import DiagnoseService from './DiagnoseService';
import Service, { Inject } from './Service';
import VersionService from './VersionService';
import InstanceService from './InstanceService';

function onerror(e: { message: string; type: string }) {
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

export default class LaunchService extends Service {
    @Inject('DiagnoseService')
    private diagnoseService!: DiagnoseService;

    @Inject('VersionService')
    private versionService!: VersionService;

    @Inject('AuthLibService')
    private authLibService!: AuthLibService;

    @Inject('InstanceService')
    private instanceService!: InstanceService;

    async launch() {
        try {
            if (this.state.launch.status !== 'ready') {
                return false;
            }

            this.commit('launchStatus', 'checkingProblems');

            /**
             * current selected profile
             */
            const instance = this.getters.instance;
            const user = this.getters.user;
            const gameProfile = this.getters.gameProfile;
            if (!instance) {
                this.commit('launchErrors', { type: 'selectProfileEmpty', content: [] });
                return false;
            }
            if (user.accessToken === '' || gameProfile.name === '' || gameProfile.id === '') {
                this.commit('launchErrors', { type: 'illegalAuth', content: [] });
                return false;
            }

            for (let problems = this.getters.issues.filter(p => p.autofix), i = 0;
                problems.length !== 0 && i < 1;
                problems = this.getters.issues.filter(p => p.autofix), i += 1) {
                await this.diagnoseService.fix(this.getters.issues.filter(p => !p.optional && p.autofix));
            }

            if (this.getters.issues.some(p => !p.optional)) {
                this.commit('launchErrors', { type: 'unresolvableProblems', content: this.getters.issues.filter(p => !p.optional) });
                return false;
            }

            if (this.state.launch.status === 'ready') { // check if we have cancel (set to ready) this launch
                return false;
            }

            this.commit('launchStatus', 'launching');

            const debug = instance.showLog;
            const minecraftFolder = new Util.MinecraftFolder(join(this.state.root, 'instances', instance.id));

            /**
             * real version name
             */
            const version = await this.versionService.resolveVersion({
                ...instance.runtime,
            });

            console.log(`Will launch with ${version} version.`);

            const javaPath = this.getters.instanceJava.path || this.getters.defaultJava.path;
            /**
             * Build launch condition
             */
            const option: Launcher.Option = {
                gameProfile,
                accessToken: user.accessToken,
                properties: {},
                gamePath: minecraftFolder.root,
                resourcePath: this.state.root,
                javaPath,
                minMemory: instance.minMemory,
                maxMemory: instance.maxMemory,
                version,
                extraExecOption: {
                    detached: true,
                    cwd: undefined,
                    env: undefined,
                },
                yggdrasilAgent: user.authService !== 'mojang' && user.authService !== 'offline' ? {
                    jar: await this.authLibService.ensureAuthlibInjection(),
                    server: this.getters.authService.hostName,
                } : undefined,
            };

            if ('server' in instance && instance.server?.host) {
                console.log('Launching a server');
                option.server = {
                    ip: instance.server?.host,
                    port: instance.server?.port,
                };
            }

            this.instanceService.deploy(true);

            console.log('Launching with these option...');
            console.log(JSON.stringify(option, null, 2));

            // Launch
            const process = await Launcher.launch(option);
            this.commit('launchStatus', 'launched');
            let crashReport = '';
            let crashReportLocation = '';
            let waitForReady = true;
            const eventBus = this.managers.AppManager.eventBus;
            eventBus.emit('minecraft-start', debug);
            process.on('error', (err) => {
                console.error(err);
                this.commit('launchErrors', { type: 'general', content: [err] });
                this.commit('launchStatus', 'ready');
            });
            process.on('exit', (code, signal) => {
                console.log(`exit: ${code}, signal: ${signal}`);
                if (signal === 'SIGKILL') {
                    eventBus.emit('minecraft-killed');
                }
                if (code !== 0 && (crashReport || crashReportLocation)) {
                    eventBus.emit('minecraft-crash-report', {
                        crashReport,
                        crashReportLocation,
                    });
                    eventBus.emit('minecraft-exit', {
                        code,
                        signal,
                        crashReport,
                        crashReportLocation,
                    });
                } else {
                    eventBus.emit('minecraft-exit', { code, signal });
                }
                this.commit('launchStatus', 'ready');
            });
            /* eslint-disable no-unused-expressions */
            process.stdout?.on('data', (s) => {
                const string = s.toString();
                if (string.indexOf('---- Minecraft Crash Report ----') !== -1) {
                    crashReport = string;
                } else if (string.indexOf('Crash report saved to:') !== -1) {
                    crashReportLocation = string.substring(string.indexOf('Crash report saved to:') + 'Crash report saved to: #@!@# '.length);
                } else if (waitForReady && string.indexOf('Reloading ResourceManager') !== -1 || string.indexOf('LWJGL Version: ') !== -1) {
                    waitForReady = false;
                    eventBus.emit('minecraft-window-ready');
                    this.commit('launchStatus', 'minecraftReady');
                }
                eventBus.emit('minecraft-stdout', string);
            });
            process.stderr?.on('data', (s) => {
                console.warn(s.toString());
                eventBus.emit('minecraft-stderr', s.toString());
            });
            process.unref();
            return true;
        } catch (e) {
            this.commit('launchErrors', { type: 'general', content: [e] });
            this.commit('launchStatus', 'ready');
            return false;
        }
    }
}
