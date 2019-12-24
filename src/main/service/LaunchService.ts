import { launch, MinecraftFolder, LaunchOption } from '@xmcl/core';
import { makeException } from 'main/utils';
import { ChildProcess } from 'child_process';
import { join } from 'path';
import AuthLibService from './AuthLibService';
import DiagnoseService from './DiagnoseService';
import InstanceService from './InstanceService';
import Service, { Inject } from './Service';
import VersionService from './VersionService';

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

    private launchedProcess: ChildProcess | undefined;
    
    /**
     * Launch the current selected instance. This will return a boolean promise indeicate whether launch is success.
     * @param force 
     * @returns Does this launch request success?
     */
    async launch(force?: boolean) {
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
            if (user.accessToken === '' || gameProfile.name === '' || gameProfile.id === '') {
                throw makeException({ type: 'launchIllegalAuth' });
            }

            for (let problems = this.getters.issues.filter(p => p.autofix), i = 0;
                problems.length !== 0 && i < 1;
                problems = this.getters.issues.filter(p => p.autofix), i += 1) {
                await this.diagnoseService.fix(this.getters.issues.filter(p => !p.optional && p.autofix));
            }

            if (!force && this.getters.issues.some(p => !p.optional)) {
                throw makeException({ type: 'launchBlockedIssues', issues: this.getters.issues.filter(p => !p.optional) });
            }

            if (this.state.launch.status === 'ready') { // check if we have cancel (set to ready) this launch
                return false;
            }

            this.commit('launchStatus', 'launching');

            const showLog = instance.showLog;
            const minecraftFolder = new MinecraftFolder(join(this.state.root, 'instances', instance.path));

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
            const option: LaunchOption = {
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
                    cwd: minecraftFolder.root,
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
            const process = await launch(option);
            this.launchedProcess = process;
            this.commit('launchStatus', 'launched');
            let crashReport = '';
            let crashReportLocation = '';
            let waitForReady = true;
            const eventBus = this.managers.AppManager.app;
            eventBus.emit('minecraft-start', showLog);
            process.on('error', (err) => {
                this.pushException({ type: 'launchGeneralException', error: err });
                this.commit('launchStatus', 'ready');
            });

            process.on('exit', (code, signal) => {
                console.log(`Minecraft exit: ${code}, signal: ${signal}`);
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
                this.launchedProcess = undefined;
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
            this.commit('launchStatus', 'ready');
            throw makeException({ type: 'launchGeneralException', error: e });
        }
    }
}
