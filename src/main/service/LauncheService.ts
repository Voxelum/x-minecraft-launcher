import { Launcher, Util } from '@xmcl/minecraft-launcher-core';
import { fs } from 'main/utils';
import { join } from 'path';
import AuthLibService from './AuthLibService';
import DiagnoseService from './DiagnoseService';
import ResourceService from './ResourceService';
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

export default class LauncheService extends Service {
    @Inject('DiagnoseService')
    private diagnoseService!: DiagnoseService;

    @Inject('VersionService')
    private versionService!: VersionService;

    @Inject('ResourceService')
    private resourceService!: ResourceService;

    @Inject('AuthLibService')
    private authLibService!: AuthLibService;

    async launch() {
        try {
            if (this.state.launch.status !== 'ready' && this.state.launch.status !== 'error') {
                return false;
            }

            this.commit('launchStatus', 'checkingProblems');

            /**
             * current selected profile
             */
            const profile = this.getters.selectedProfile;
            const user = this.getters.selectedUser;
            const gameProfile = this.getters.selectedGameProfile;
            if (!profile) {
                this.commit('launchErrors', { type: 'selectProfileEmpty', content: [] });
                return false;
            }
            if (user.accessToken === '' || gameProfile.name === '' || gameProfile.id === '') {
                this.commit('launchErrors', { type: 'illegalAuth', content: [] });
                return false;
            }

            for (let problems = this.getters.problems.filter(p => p.autofix), i = 0;
                problems.length !== 0 && i < 1;
                problems = this.getters.problems.filter(p => p.autofix), i += 1) {
                await this.diagnoseService.fixProfile(this.getters.problems.filter(p => !p.optional && p.autofix));
            }

            if (this.getters.problems.some(p => !p.optional)) {
                this.commit('launchErrors', { type: 'unresolvableProblems', content: this.getters.problems.filter(p => !p.optional) });
                return false;
            }

            if (this.state.launch.status === 'ready') { // check if we have cancel (set to ready) this launch
                return false;
            }

            this.commit('launchStatus', 'launching');

            const debug = profile.showLog;
            const minecraftFolder = new Util.MinecraftFolder(join(this.state.root, 'profiles', profile.id));

            /**
             * real version name
             */
            const version = await this.versionService.resolveVersion({
                ...profile.version,
            });

            console.log(`Will launch with ${version} version.`);

            const java = profile.java || this.getters.defaultJava;
            /**
             * Build launch condition
             */
            const option: Launcher.Option = {
                gameProfile,
                accessToken: user.accessToken,
                properties: {},
                gamePath: minecraftFolder.root,
                resourcePath: this.state.root,
                javaPath: java.path,
                minMemory: profile.minMemory,
                maxMemory: profile.maxMemory,
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
                    await this.resourceService.deployResources({
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
                await this.resourceService.deployResources({
                    resourceUrls: this.getters.resourcepacks.map(r => r.hash),
                    profile: profile.id,
                });
            } catch (e) {
                console.error('Cannot deploy resource packs');
                console.error(e);
            }
            console.log('Launching with these option...');
            console.log(JSON.stringify(option));

            // Launch
            const process = await Launcher.launch(option);
            this.commit('launchStatus', 'launched');
            let crashReport = '';
            let crashReportLocation = '';
            let waitForReady = true;
            const eventBus = this.managers.AppManager.eventBus;
            eventBus.emit('minecraft-start', debug);
            process.on('error', (err) => {
                console.log(err);
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
                eventBus.emit('minecraft-stderr', s.toString());
            });
            process.unref();
        } catch (e) {
            this.commit('launchErrors', { type: 'general', content: [e] });
            return false;
        }
    }
}
