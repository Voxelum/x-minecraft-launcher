import { Exception } from '@universal/util/exception';
import { createMinecraftProcessWatcher, launch, LaunchOption, MinecraftFolder } from '@xmcl/core';
import { ChildProcess } from 'child_process';
import AuthLibService from './AuthLibService';
import DiagnoseService from './DiagnoseService';
import InstanceService from './InstanceService';
import Service, { Inject } from './Service';

export default class LaunchService extends Service {
    @Inject('DiagnoseService')
    private diagnoseService!: DiagnoseService;

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
                throw new Exception({ type: 'launchIllegalAuth' });
            }

            for (let problems = this.getters.issues.filter(p => p.autofix), i = 0;
                problems.length !== 0 && i < 1;
                problems = this.getters.issues.filter(p => p.autofix), i += 1) {
                await this.diagnoseService.fix(this.getters.issues.filter(p => !p.optional && p.autofix));
            }

            if (!force && this.getters.issues.some(p => !p.optional)) {
                throw new Exception({ type: 'launchBlockedIssues', issues: this.getters.issues.filter(p => !p.optional) });
            }

            if (this.state.launch.status === 'ready') { // check if we have cancel (set to ready) this launch
                return false;
            }

            this.commit('launchStatus', 'launching');

            const showLog = instance.showLog;
            const minecraftFolder = new MinecraftFolder(instance.path);

            /**
             * real version name
             */
            let instanceVersion = this.getters.instanceVersion;
            if (instanceVersion.folder === 'unknown') {
                throw new Error(); // TODO: this is an exception
            }
            const version = instanceVersion.folder;

            this.log(`Will launch with ${version} version.`);

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
                this.log('Launching a server');
                option.server = {
                    ip: instance.server?.host,
                    port: instance.server?.port,
                };
            }

            this.instanceService.deploy(true);

            this.log('Launching with these option...');
            this.log(JSON.stringify(option, (k, v) => (k === 'accessToken' ? '***' : v), 2));

            // Launch
            const process = await launch(option);
            this.launchedProcess = process;
            this.commit('launchStatus', 'launched');

            const eventBus = this.appManager.app;

            eventBus.emit('minecraft-start', showLog);
            let watcher = createMinecraftProcessWatcher(process);

            watcher.on('error', (err) => {
                this.pushException({ type: 'launchGeneralException', error: err });
                this.commit('launchStatus', 'ready');
            }).on('minecraft-exit', ({ code, signal, crashReport, crashReportLocation }) => {
                this.log(`Minecraft exit: ${code}, signal: ${signal}`);
                eventBus.emit('minecraft-exit', {
                    code,
                    signal,
                    crashReport,
                    crashReportLocation,
                });
                this.commit('launchStatus', 'ready');
                this.launchedProcess = undefined;
            }).on('minecraft-window-ready', () => {
                eventBus.emit('minecraft-window-ready');
            });
            /* eslint-disable no-unused-expressions */
            process.stdout?.on('data', (s) => {
                const string = s.toString();
                eventBus.emit('minecraft-stdout', string);
            });
            process.stderr?.on('data', (s) => {
                this.warn(s.toString());
                eventBus.emit('minecraft-stderr', s.toString());
            });
            process.unref();
            return true;
        } catch (e) {
            this.commit('launchStatus', 'ready');
            throw new Exception({ type: 'launchGeneralException', error: e });
        }
    }
}
