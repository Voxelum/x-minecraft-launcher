import { Exception } from '@universal/util/exception';
import { createMinecraftProcessWatcher, launch, LaunchOption, MinecraftFolder } from '@xmcl/core';
import { ChildProcess } from 'child_process';
import ExternalAuthSkinService from './ExternalAuthSkinService';
import DiagnoseService from './DiagnoseService';
import Service, { Inject } from './Service';
import InstanceResourceService from './InstanceResourceService';

export default class LaunchService extends Service {
    @Inject('DiagnoseService')
    private diagnoseService!: DiagnoseService;

    @Inject('ExternalAuthSkinService')
    private externalAuthSkinService!: ExternalAuthSkinService;

    @Inject('InstanceResourceService')
    private instanceResourceService!: InstanceResourceService;

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

            const minecraftFolder = new MinecraftFolder(instance.path);

            /**
             * real version name
             */
            let instanceVersion = this.getters.instanceVersion;
            if (instanceVersion.folder === 'unknown') {
                throw new Exception({ type: 'launchNoVersionInstalled' });
            }
            const version = instanceVersion.folder;

            this.log(`Will launch with ${version} version.`);

            const javaPath = this.getters.instanceJava.path || this.getters.defaultJava.path;

            const allPacks = this.state.resource.domains.resourcepacks;
            const deploiedPacks = this.state.instance.resourcepacks;

            const toBeDeploiedPacks = allPacks.filter(p => !deploiedPacks.find((r) => r.hash === p.hash));
            this.log(`Deploying ${toBeDeploiedPacks.length} resource packs`);
            await this.instanceResourceService.deploy(toBeDeploiedPacks);
            const useAuthLib = user.authService !== 'mojang' && user.authService !== 'offline';

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
                minMemory: instance.minMemory ? instance.minMemory : undefined,
                maxMemory: instance.maxMemory ? instance.maxMemory : undefined,
                version,
                extraExecOption: {
                    detached: true,
                    cwd: minecraftFolder.root,
                },
                yggdrasilAgent: useAuthLib ? {
                    jar: await this.externalAuthSkinService.installAuthlibInjection(),
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

            this.log('Launching with these option...');
            this.log(JSON.stringify(option, (k, v) => (k === 'accessToken' ? '***' : v), 2));

            // Launch
            const process = await launch(option);
            this.launchedProcess = process;
            this.commit('launchStatus', 'launched');

            this.app.emit('minecraft-start', { 
                version: instanceVersion.folder,
                minecraft: instanceVersion.minecraft,
                forge: instanceVersion.forge,
                fabric: instanceVersion.fabricLoader,
            });
            let watcher = createMinecraftProcessWatcher(process);

            watcher.on('error', (err) => {
                this.pushException({ type: 'launchGeneralException', error: err });
                this.commit('launchStatus', 'ready');
            }).on('minecraft-exit', ({ code, signal, crashReport, crashReportLocation }) => {
                this.log(`Minecraft exit: ${code}, signal: ${signal}`);
                if (crashReportLocation) {
                    crashReportLocation = crashReportLocation.substring(0, crashReportLocation.lastIndexOf('.txt') + 4);
                }
                this.app.emit('minecraft-exit', {
                    code,
                    signal,
                    crashReport,
                    crashReportLocation: crashReportLocation ? crashReportLocation.replace('\r\n', '').trim() : '',
                });
                this.commit('launchStatus', 'ready');
                this.launchedProcess = undefined;
            }).on('minecraft-window-ready', () => {
                this.app.emit('minecraft-window-ready');
            });
            /* eslint-disable no-unused-expressions */
            process.stdout?.on('data', (s) => {
                const string = s.toString();
                this.app.emit('minecraft-stdout', string);
            });
            process.stderr?.on('data', (s) => {
                this.warn(s.toString());
                this.app.emit('minecraft-stderr', s.toString());
            });
            process.unref();
            return true;
        } catch (e) {
            this.commit('launchStatus', 'ready');
            throw new Exception({ type: 'launchGeneralException', error: e });
        }
    }
}
