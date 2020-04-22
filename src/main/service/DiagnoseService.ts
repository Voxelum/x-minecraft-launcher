import { exists } from '@main/util/fs';
import { Issue, IssueReport } from '@universal/store/modules/diagnose';
import { LocalVersion } from '@universal/store/modules/version';
import { MinecraftFolder, ResolvedLibrary } from '@xmcl/core';
import { Diagnosis, Installer } from '@xmcl/installer';
import { InstallProfile } from '@xmcl/installer/minecraft';
import { Forge } from '@xmcl/mod-parser';
import { readJSON } from 'fs-extra';
import { ArtifactVersion, VersionRange } from 'maven-artifact-version';
import { basename, join, relative } from 'path';
import AuthLibService from './AuthLibService';
import InstallService from './InstallService';
import InstanceService from './InstanceService';
import JavaService from './JavaService';
import Service, { Inject, MutationTrigger, Singleton } from './Service';
import VersionService from './VersionService';


export interface Fix {
    match(issues: Issue[]): boolean;
    fix(issues: Issue[]): Promise<void>;
    recheck: string;
}

export default class DiagnoseService extends Service {
    @Inject('VersionService')
    private versionService!: VersionService;

    @Inject('InstallService')
    private installService!: InstallService;

    @Inject('AuthLibService')
    private authLibService!: AuthLibService;

    @Inject('JavaService')
    private javaService!: JavaService;

    @Inject('InstanceService')
    private instanceService!: InstanceService;

    private fixes: Fix[] = [];

    registerMatchedFix(matched: string[], fixFunc: (issues: Issue[]) => Promise<any> | void, recheck?: string) {
        this.fixes.push({
            match(issues) {
                return issues.some(i => matched.indexOf(i.id) !== -1);
            },
            fix(issues) {
                const filtered = issues.filter(i => matched.indexOf(i.id) !== -1);
                const result = fixFunc(filtered);
                if (result instanceof Promise) { return result.then(() => { }); }
                return Promise.resolve(result);
            },
            recheck: recheck || '',
        });
    }

    constructor() {
        super();
        this.registerMatchedFix(['missingVersion'],
            () => this.commit('instance', { runtime: { minecraft: this.getters.minecraftRelease.id }, path: this.state.instance.path }),
            'diagnoseVersion');
        this.registerMatchedFix(['missingVersionJson', 'missingVersionJar', 'corruptedVersionJson', 'corruptedVersionJar'],
            async (issues) => {
                const i = issues[0];
                const { minecraft, forge } = i.arguments! as LocalVersion;
                const metadata = this.state.version.minecraft.versions.find(v => v.id === minecraft);
                if (metadata) {
                    await this.installService.installMinecraft(metadata);
                    if (forge) {
                        const found = this.state.version.forge[minecraft]
                            ?.versions.find(v => v.version === forge);
                        if (found) {
                            const forge = found;
                            const fullVersion = await this.installService.installForge(forge);
                            if (fullVersion) {
                                // await this.install.installDependencies(fullVersion);
                            }
                        } else {
                            this.pushException({ type: 'fixVersionNoForgeVersionMetadata', minecraft, forge });
                        }
                    }
                    // TODO: check liteloader fabric
                } else {
                    this.pushException({ type: 'fixVersionNoVersionMetadata', minecraft });
                }
            },
            'diagnoseVersion');

        this.registerMatchedFix(['missingForge'],
            async (issues) => {
                if (!issues[0].arguments) return;
                let { minecraft, forge } = issues[0].arguments;
                let forgeVer = this.state.version.forge[minecraft]?.versions.find(v => v.version === forge);
                if (!forgeVer) {
                    await this.installService.installForge({ mcversion: minecraft, version: forge });
                } else {
                    await this.installService.installForge(forgeVer);
                }
            },
            'diagnoseVersion');


        this.registerMatchedFix(['missingAssetsIndex', 'corruptedAssetsIndex'],
            (issues) => this.installService.installAssetsAll(issues[0].arguments.version),
            'diagnoseVersion');

        this.registerMatchedFix(['missingAssets', 'corruptedAssets'],
            (issues) => {
                let assets = [
                    ...issues.filter(i => i.multi).map(i => i.arguments.values).reduce((a, b) => [...a, ...b], []),
                    ...issues.filter(i => !i.multi).map(i => i.arguments),
                ];
                return this.installService.installAssets(assets);
            },
            'diagnoseVersion');

        this.registerMatchedFix(['missingLibraries', 'corruptedLibraries'],
            async (issues) => {
                let libs = [
                    ...issues.filter(i => i.multi).map(i => i.arguments.values).reduce((a, b) => [...a, ...b], []),
                    ...issues.filter(i => !i.multi).map(i => i.arguments),
                ];
                return this.installService.installLibraries({ libraries: libs });
            },
            'diagnoseVersion');

        this.registerMatchedFix(['badInstall'],
            async (issues) => {
                let task = Installer.installByProfileTask(issues[0].arguments.installProfile, this.state.root, { java: this.getters.defaultJava.path });
                await this.submit(task).wait();
            },
            'diagnoseVersion');
        this.registerMatchedFix(['missingAuthlibInjector'],
            () => this.authLibService.ensureAuthlibInjection(),
            'diagnoseServer');
    }

    @MutationTrigger('instanceSelect')
    async onInstanceSelect() {
        this.commit('aquire', 'diagnose');
        await this.diagnoseVersion();
        await this.diagnoseJava();
        await this.diagnoseMods();
        await this.diagnoseResourcePacks();
        await this.diagnoseServer();
        this.commit('release', 'diagnose');
    }

    @MutationTrigger('instance')
    async onInstance(payload: any) {
        if (payload.path !== this.state.instance.path) {
            return;
        }
        if ('runtime' in payload) {
            this.commit('aquire', 'diagnose');
            await this.diagnoseVersion();
            await this.diagnoseJava();
            await this.diagnoseMods();
            await this.diagnoseResourcePacks();
            await this.diagnoseServer();
            this.commit('release', 'diagnose');
            return;
        }
        if ('java' in payload) {
            await this.diagnoseJava();
        }
        if ('deployments' in payload) {
            if ('mods' in payload.deployments) {
                await this.diagnoseMods();
            }
            if ('resourcepacks' in payload.deployments) {
                await this.diagnoseResourcePacks();
            }
        }
    }

    @MutationTrigger('userGameProfileSelect', 'userProfileUpdate')
    async onUserUpdate() {
        await this.diagnoseUser();
    }

    @MutationTrigger('instanceStatus')
    async onInstanceStatus() {
        if (this.getters.busy('diagnose')) return;
        await this.diagnoseServer();
    }

    async init() {
        this.commit('aquire', 'diagnose');
        try {
            this.log('Init with a full diagnose');
            await this.diagnoseVersion();
            await this.diagnoseJava();
            await this.diagnoseMods();
            await this.diagnoseResourcePacks();
            await this.diagnoseServer();
            await this.diagnoseUser();
        } finally {
            this.commit('release', 'diagnose');
        }
    }

    @Singleton()
    async diagnoseMods() {
        this.commit('aquire', 'diagnose');
        try {
            const { runtime: version } = this.getters.instance;
            const resources = this.getters.instanceResources;
            if (!resources) return;

            const mcversion = version.minecraft;
            const resolvedMcVersion = ArtifactVersion.of(mcversion);
            const pattern = /^\[.+\]$/;

            const tree: Pick<IssueReport, 'unknownMod' | 'incompatibleMod'> = {
                unknownMod: [],
                incompatibleMod: [],
            };
            for (const mod of resources.filter(m => !!m && m.type === 'forge')) {
                const metadatas: Forge.ModMetaData[] = mod.metadata;
                for (const meta of metadatas) {
                    let acceptVersion = meta.acceptedMinecraftVersions;
                    if (!acceptVersion) {
                        if (!meta.mcversion) {
                            tree.unknownMod.push({ name: mod.name, actual: mcversion });
                            continue;
                        }
                        acceptVersion = pattern.test(meta.mcversion) ? meta.mcversion : `[${meta.mcversion}]`;
                    }
                    if (!acceptVersion) {
                        tree.unknownMod.push({ name: mod.name, actual: mcversion });
                        continue;
                    }
                    const range = VersionRange.createFromVersionSpec(acceptVersion);
                    if (range && !range.containsVersion(resolvedMcVersion)) {
                        tree.incompatibleMod.push({ name: mod.name, accepted: acceptVersion, actual: mcversion });
                    }
                }
            }
            this.commit('issuesPost', tree);
        } finally {
            this.commit('release', 'diagnose');
        }
    }

    @Singleton()
    async diagnoseResourcePacks() {
        this.commit('aquire', 'diagnose');
        try {
            const { runtime: version } = this.getters.instance;
            const resources = this.getters.instanceResources;
            const mcversion = version.minecraft;
            const resolvedMcVersion = ArtifactVersion.of(mcversion);

            if (!resources) return;

            const tree: Pick<IssueReport, 'incompatibleResourcePack'> = {
                incompatibleResourcePack: [],
            };

            const packFormatMapping = this.state.client.packFormatMapping.mcversion;
            for (const pack of resources.filter(r => r.type === 'resourcepack')) {
                if (pack.metadata.format in packFormatMapping) {
                    const acceptVersion = packFormatMapping[pack.metadata.format];
                    const range = VersionRange.createFromVersionSpec(acceptVersion);
                    if (range && !range.containsVersion(resolvedMcVersion)) {
                        tree.incompatibleResourcePack.push({ name: pack.name, accepted: acceptVersion, actual: mcversion });
                    }
                }
            }

            this.commit('issuesPost', tree);
        } finally {
            this.commit('release', 'diagnose');
        }
    }

    @Singleton()
    async diagnoseUser() {
        this.commit('aquire', 'diagnose');
        try {
            const user = this.getters.user;

            const tree: Pick<IssueReport, 'missingAuthlibInjector'> = {
                missingAuthlibInjector: [],
            };

            if (user.authService !== 'mojang' && user.authService !== 'offline') {
                if (!await this.authLibService.doesAuthlibInjectionExisted()) {
                    tree.missingAuthlibInjector.push({});
                }
            }

            this.commit('issuesPost', tree);
        } finally {
            this.commit('release', 'diagnose');
        }
    }

    @Singleton()
    async diagnoseJava() {
        this.commit('aquire', 'diagnose');
        try {
            const instance = this.getters.instance;
            const resolvedJava = this.getters.instanceJava;

            const mcversion = instance.runtime.minecraft;
            const resolvedMcVersion = ArtifactVersion.of(mcversion);

            const tree: Pick<IssueReport, 'incompatibleJava'> = {
                incompatibleJava: [],
            };

            // TODO: handle not existed java
            if (resolvedJava && resolvedJava.majorVersion > 8) {
                if (!resolvedMcVersion.minorVersion || resolvedMcVersion.minorVersion < 13) {
                    tree.incompatibleJava.push({ java: resolvedJava.version, version: mcversion, type: 'Minecraft' });
                } else if (resolvedMcVersion.minorVersion >= 13 && instance.runtime.forge && resolvedJava.majorVersion > 10) {
                    tree.incompatibleJava.push({ java: resolvedJava.version, version: instance.runtime.forge, type: 'MinecraftForge' });
                }
            }

            this.commit('issuesPost', tree);
        } finally {
            this.commit('release', 'diagnose');
        }
    }

    @Singleton()
    async diagnoseFailure(log: string) {
        const tree: Pick<IssueReport, 'badForge'> = {
            badForge: [],
        };

        let lines = log.split('\n').map(l => l.trim()).filter(l => l.length !== 0);
        for (let line of lines) {
            let reg = line.match(/\[main\/FATAL\] \[net\.minecraftforge\.fml\.loading\.FMLCommonLaunchHandler\/CORE\]: Failed to find Minecraft resource version/);
            if (reg) {
                let path = reg[2];
                let jarName = basename(path);
                let [, minecraft, forge] = jarName.substring(0, jarName.length - '-client.jar'.length).split('-');
                tree.badForge.push({ minecraft, forge });
            }
        }

        this.commit('issuesPost', tree);
    }

    @Singleton()
    async diagnoseServer() {
        this.commit('aquire', 'diagnose');
        try {
            const stat = this.getters.instance.serverStatus;

            const tree: Pick<IssueReport, 'missingModsOnServer'> = {
                missingModsOnServer: [],
            };

            if (stat && stat.modinfo) {
                const info = stat.modinfo;
                tree.missingModsOnServer.push(...info.modList);
            }

            this.commit('issuesPost', tree);
        } finally {
            this.commit('release', 'diagnose');
        }
    }

    @Singleton()
    async diagnoseVersion() {
        this.commit('aquire', 'diagnose');
        try {
            let id = this.state.instance.path;
            let selected = this.state.instance.all[id];
            if (!selected) {
                this.error(`No profile selected! ${id}`);
                return;
            }
            await this.versionService.refreshVersions();
            let currentVersion = { ...this.getters.instanceVersion };
            let targetVersion = currentVersion.folder;
            let mcversion = currentVersion.minecraft;
            let forge = currentVersion.forge;

            let mcLocation = MinecraftFolder.from(this.state.root);

            type VersionReport = Pick<IssueReport,
                'missingVersionJar' |
                'missingAssetsIndex' |
                'missingVersionJson' |
                'missingLibraries' |
                'missingAssets' |
                'missingVersion' |

                'corruptedVersionJar' |
                'corruptedAssetsIndex' |
                'corruptedVersionJson' |
                'corruptedLibraries' |
                'corruptedAssets' |

                'badInstall' |

                'missingForge' |
                'missingLiteloader'>;

            let tree: VersionReport = {
                missingVersion: [],
                missingVersionJar: [],
                missingAssetsIndex: [],
                missingVersionJson: [],
                missingLibraries: [],
                missingAssets: [],

                corruptedVersionJar: [],
                corruptedAssetsIndex: [],
                corruptedVersionJson: [],
                corruptedLibraries: [],
                corruptedAssets: [],

                missingForge: [],
                missingLiteloader: [],

                badInstall: [],
            };

            if (targetVersion === 'unknown') {
                if (currentVersion.minecraft) {
                    tree.missingVersionJson.push({ version: currentVersion.minecraft, ...currentVersion });
                }

                if (currentVersion.forge) {
                    let forge = this.state.version.local.find(v => v.forge === currentVersion.forge);
                    if (!forge) {
                        tree.missingForge.push({ forge: currentVersion.forge, minecraft: currentVersion.minecraft });
                    }
                }

                if (currentVersion.liteloader) {
                    let liteloader = this.state.version.local.find(v => v.liteloader === currentVersion.liteloader);
                    if (!liteloader) {
                        tree.missingLiteloader.push({ liteloader: currentVersion.liteloader, minecraft: currentVersion.minecraft });
                    }
                }
            } else {
                this.log(`Diagnose for version ${targetVersion}`);

                let location = this.state.root;
                let gameReport = await Diagnosis.diagnose(targetVersion, location);

                for (let issue of gameReport.issues) {
                    if (issue.role === 'versionJson') {
                        if (issue.type === 'corrupted') {
                            tree.corruptedVersionJson.push({ version: issue.version, ...currentVersion, file: relative(this.state.root, issue.file) });
                        } else {
                            tree.missingVersionJson.push({ version: issue.version, ...currentVersion, file: relative(this.state.root, issue.file) });
                        }
                    } else if (issue.role === 'minecraftJar') {
                        if (issue.type === 'corrupted') {
                            tree.corruptedVersionJar.push({ version: issue.version, ...currentVersion, file: relative(this.state.root, issue.file) });
                        } else {
                            tree.missingVersionJar.push({ version: issue.version, ...currentVersion, file: relative(this.state.root, issue.file) });
                        }
                    } else if (issue.role === 'assetIndex') {
                        if (issue.type === 'corrupted') {
                            tree.corruptedAssetsIndex.push({ version: issue.version, file: relative(this.state.root, issue.file) });
                        } else {
                            tree.missingAssetsIndex.push({ version: issue.version, file: relative(this.state.root, issue.file) });
                        }
                    } else if (issue.role === 'asset') {
                        if (issue.type === 'corrupted') {
                            tree.corruptedAssets.push({ ...issue.asset, version: currentVersion.minecraft, hash: issue.asset.hash, file: relative(this.state.root, issue.file) });
                        } else {
                            tree.missingAssets.push({ ...issue.asset, version: currentVersion.minecraft, hash: issue.asset.hash, file: relative(this.state.root, issue.file) });
                        }
                    } else if (issue.role === 'library') {
                        if (issue.type === 'corrupted') {
                            tree.corruptedLibraries.push({ ...issue.library, file: relative(this.state.root, issue.file) });
                        } else {
                            tree.missingLibraries.push({ ...issue.library, file: relative(this.state.root, issue.file) });
                        }
                    }
                }

                let root = mcLocation.getVersionRoot(targetVersion);
                let installProfilePath = join(root, 'install_profile.json');
                if (await exists(installProfilePath)) {
                    let installProfile: InstallProfile = await readJSON(installProfilePath);
                    let report = await Diagnosis.diagnoseInstall(installProfile, mcLocation.root);
                    let missedInstallProfileLibs: IssueReport['missingLibraries'] = [];
                    let corruptedInstallProfileLibs: IssueReport['corruptedLibraries'] = [];
                    let badInstall = false;
                    for (let issue of report.issues) {
                        if (issue.role === 'processor') {
                            badInstall = true;
                        } else if (issue.role === 'library') {
                            if (issue.type === 'corrupted') {
                                corruptedInstallProfileLibs.push({ ...issue.library, file: relative(this.state.root, issue.file) });
                            } else {
                                missedInstallProfileLibs.push({ ...issue.library, file: relative(this.state.root, issue.file) });
                            }
                        }
                    }
                    if (badInstall) {
                        tree.badInstall.push({ version: targetVersion, installProfile: report.installProfile, minecraft: mcversion });
                        tree.corruptedLibraries.push(...corruptedInstallProfileLibs);
                        tree.missingLibraries.push(...missedInstallProfileLibs);
                    }
                }
            }
            this.commit('issuesPost', tree);
        } finally {
            this.commit('release', 'diagnose');
        }
    }

    @Singleton('diagnose')
    async fix(issues: Issue[]) {
        const unfixed = issues.filter(p => p.autofix)
            .filter(p => !this.state.diagnose.registry[p.id].fixing);

        if (unfixed.length === 0) return;

        this.log(`Start fixing ${issues.length} issues: ${JSON.stringify(issues.map(i => i.id))}`);

        const recheck = {};

        this.commit('issuesStartResolve', unfixed);

        for (const fix of this.fixes) {
            if (fix.match(issues)) {
                await fix.fix(issues).catch(e => this.pushException({ type: 'issueFix', error: e }));
                (recheck as any)[fix.recheck] = true;
            }
        }

        const self = this as any;
        for (const action of Object.keys(recheck)) {
            if (action in self) { self[action](); }
        }

        this.commit('issuesEndResolve', unfixed);
    }

    async fixJavaIncompatible() {
        let instancePath = this.state.instance.path;
        await this.javaService.installJava();
        await this.instanceService.editInstance({ instancePath, java: '8' });
        await this.instanceService.setJavaPath(this.javaService.getInternalJavaLocation());
    }
}
