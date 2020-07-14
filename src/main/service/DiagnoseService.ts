import { exists, missing } from '@main/util/fs';
import { FabricResource } from '@main/util/resource';
import { Issue, IssueReport } from '@universal/store/modules/diagnose';
import { EMPTY_JAVA } from '@universal/store/modules/java';
import { LocalVersion } from '@universal/store/modules/version';
import { getExpectVersion, compareRelease } from '@universal/util/version';
import { MinecraftFolder } from '@xmcl/core';
import { Diagnosis, Installer } from '@xmcl/installer';
import { InstallProfile } from '@xmcl/installer/minecraft';
import { Forge } from '@xmcl/mod-parser';
import { ModMetadata } from '@xmcl/mod-parser/fabric';
import { PackMeta } from '@xmcl/resourcepack';
import { readJSON } from 'fs-extra';
import { ArtifactVersion, VersionRange } from 'maven-artifact-version';
import { basename, join, relative } from 'path';
import ExternalAuthSkinService from './ExternalAuthSkinService';
import InstallService from './InstallService';
import InstanceService from './InstanceService';
import JavaService from './JavaService';
import Service, { Inject, MutationTrigger, Singleton } from './Service';
import VersionService from './VersionService';


export interface Fix {
    match(issues: readonly Issue[]): boolean;
    fix(issues: readonly Issue[]): Promise<void>;
    recheck: string;
}

export default class DiagnoseService extends Service {
    @Inject('VersionService')
    private versionService!: VersionService;

    @Inject('InstallService')
    private installService!: InstallService;

    @Inject('ExternalAuthSkinService')
    private externalAuthSkinService!: ExternalAuthSkinService;

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
        this.registerMatchedFix(['missingVersionJson', 'missingVersionJar', 'corruptedVersionJson', 'corruptedVersionJar'],
            async (issues) => {
                const i = issues[0];
                const { minecraft, forge, fabricLoader, yarn } = i.arguments! as LocalVersion;
                const metadata = this.state.version.minecraft.versions.find(v => v.id === minecraft);
                if (metadata) {
                    await this.installService.installMinecraft(metadata);
                    if (forge) {
                        const found = this.state.version.forge.find(f => f.mcversion === minecraft)
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
                    if (fabricLoader && yarn) {
                        await this.installService.installFabric({ yarn, loader: fabricLoader });
                    }

                    // TODO: check liteloader fabric
                } else {
                    this.pushException({ type: 'fixVersionNoVersionMetadata', minecraft });
                }
            },
            'diagnoseVersion');

        this.registerMatchedFix(['missingVersion'],
            async (issues) => {
                if (!issues[0].arguments) return;
                let { minecraft, forge, fabricLoader, yarn } = issues[0].arguments;
                let targetVersion: string | undefined;
                if (minecraft && this.state.version.local.every(v => v.minecraft !== minecraft)) {
                    let metadata = this.state.version.minecraft.versions.find(v => v.id === minecraft);
                    if (metadata) {
                        await this.installService.installMinecraft(metadata);
                    }
                    targetVersion = metadata?.id;
                }
                if (forge) {
                    let forgeVer = this.state.version.forge[minecraft]?.versions.find(v => v.version === forge);
                    if (!forgeVer) {
                        targetVersion = await this.installService.installForge({ mcversion: minecraft, version: forge });
                    } else {
                        targetVersion = await this.installService.installForge(forgeVer);
                    }
                } else if (fabricLoader) {
                    targetVersion = await this.installService.installFabric({ yarn, loader: fabricLoader });
                }
                if (targetVersion) {
                    await this.installService.installDependencies(targetVersion);
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
            () => this.externalAuthSkinService.ensureAuthlibInjection(),
            'diagnoseServer');

        this.registerMatchedFix(['missingCustomSkinLoader'],
            async ([issue]) => {
                const { target, missingJar } = issue.arguments;
                const instance = this.getters.instance;
                const { fabricLoader, forge, minecraft } = instance.runtime;
                if (target === 'forge') {
                    if (!forge) {
                        const forges = this.state.version.forge.find(f => f.mcversion === minecraft);
                        if (forges) {
                            let version = forges.versions.find(v => v.type === 'latest') ?? forges.versions.find(v => v.type === 'common');
                            if (version) {
                                await this.instanceService.editInstance({ runtime: { forge: version?.version ?? '' } });
                            }
                        }
                    }
                    if (missingJar) {
                        await this.externalAuthSkinService.downloadCustomSkinLoader('forge');
                    }
                } else {
                    if (!fabricLoader) {
                        const loader = this.state.version.fabric.loaders[0]?.version ?? '';
                        const yarn = this.state.version.fabric.yarns.find(y => y.gameVersion === 'minecraft')?.version ?? '';
                        const runtime = { yarn, fabricLoader: loader };
                        await this.instanceService.editInstance({ runtime });
                    }
                    if (missingJar) {
                        await this.externalAuthSkinService.downloadCustomSkinLoader('forge');
                    }
                }
            },
            'diagnoseCustomSkin');

        this.registerMatchedFix(['invalidJava'],
            () => this.instanceService.editInstance({ java: this.getters.defaultJava.path }),
            // here the editInstance will automatically diagnose for java
            '');
    }

    @MutationTrigger('instanceSelect')
    async onInstanceSelect() {
        this.aquire('diagnose');
        const report: Partial<IssueReport> = {};
        await this.diagnoseVersion(report);
        await this.diagnoseJava(report);
        await this.diagnoseServer(report);
        await this.diagnoseCustomSkin(report);
        this.report(report);
        this.release('diagnose');
    }

    @MutationTrigger('instanceMods', 'instanceModAdd', 'instanceModRemove')
    async onInstanceModsLoad() {
        this.aquire('diagnose');
        const report: Partial<IssueReport> = {};
        await this.diagnoseMods(report);
        this.report(report);
        this.release('diagnose');
    }

    @MutationTrigger('instanceGameSettings')
    async onInstanceResourcepacksLaod(payload: any) {
        if ('resourcePacks' in payload) {
            this.aquire('diagnose');
            const report: Partial<IssueReport> = {};
            await this.diagnoseResourcePacks(report);
            this.report(report);
            this.release('diagnose');
        }
    }

    @MutationTrigger('instance')
    async onInstance(payload: any) {
        if (payload.path !== this.state.instance.path) {
            return;
        }
        const report: Partial<IssueReport> = {};
        if ('runtime' in payload) {
            this.aquire('diagnose');
            await this.diagnoseVersion(report);
            await this.diagnoseJava(report);
            await this.diagnoseServer(report);
            await this.diagnoseCustomSkin(report);
            this.release('diagnose');
            this.report(report);
            return;
        }
        if ('java' in payload) {
            await this.diagnoseJava(report);
        }
        this.report(report);
    }

    @MutationTrigger('userGameProfileSelect', 'userProfileUpdate')
    async onUserUpdate() {
        const report: Partial<IssueReport> = {};
        await this.diagnoseCustomSkin(report);
        await this.diagnoseUser(report);
        this.report(report);
    }

    @MutationTrigger('instanceStatus')
    async onInstanceStatus() {
        const report: Partial<IssueReport> = {};
        await this.diagnoseServer(report);
        this.report(report);
    }

    async init() {
        this.aquire('diagnose');
        try {
            this.log('Init with a full diagnose');
            const report: Partial<IssueReport> = {};
            await this.diagnoseVersion(report);
            await this.diagnoseJava(report);
            await this.diagnoseServer(report);
            await this.diagnoseCustomSkin(report);
            await this.diagnoseUser(report);
            this.report(report);
        } finally {
            this.release('diagnose');
        }
    }

    @Singleton()
    async diagnoseMods(report: Partial<IssueReport>) {
        this.aquire('diagnose');
        try {
            const { runtime: version } = this.getters.instance;
            const mods = this.state.instance.mods;
            if (typeof mods === 'undefined') {
                this.warn(`The instance mods folder is undefined ${this.state.instance.path}!`);
                return;
            }

            const mcversion = version.minecraft;
            const resolvedMcVersion = ArtifactVersion.of(mcversion);
            const pattern = /^\[.+\]$/;

            const tree: Pick<IssueReport, 'unknownMod' | 'incompatibleMod' | 'requireForge' | 'requireFabric' | 'requireFabricAPI'> = {
                unknownMod: [],
                incompatibleMod: [],
                requireForge: [],
                requireFabric: [],
                requireFabricAPI: [],
            };
            let forgeMods = mods.filter(m => !!m && m.type === 'forge');
            for (let mod of forgeMods) {
                let metadatas = mod.metadata as Forge.ModMetaData[];
                for (let meta of metadatas) {
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
                    let range = VersionRange.createFromVersionSpec(acceptVersion);
                    if (range && !range.containsVersion(resolvedMcVersion)) {
                        tree.incompatibleMod.push({ name: mod.name, accepted: acceptVersion, actual: mcversion });
                    }
                }
            }
            if (forgeMods.length > 0) {
                if (!version.forge) {
                    tree.requireForge.push({});
                }
            }

            let fabricMods = mods.filter(m => m.type === 'fabric') as FabricResource[];
            if (fabricMods.length > 0) {
                if (!version.fabricLoader || !version.yarn) {
                    tree.requireFabric.push({});
                }
                for (let mod of fabricMods) {
                    let fabMetadata = mod.metadata as ModMetadata;
                    if (fabMetadata.depends) {
                        let fabApiVer = (fabMetadata.depends as any)['fabric-api-base'];
                        if (fabApiVer && !fabricMods.some(m => m.metadata.id === 'fabric')) {
                            tree.requireFabricAPI.push({ version: fabApiVer, name: mod.name });
                        }
                    }
                }
            }

            Object.assign(report, tree);
        } finally {
            this.release('diagnose');
        }
    }

    @Singleton()
    async diagnoseResourcePacks(report: Partial<IssueReport>) {
        this.aquire('diagnose');
        try {
            const { runtime: version } = this.getters.instance;
            const resourcePacks = this.state.instance.settings.resourcePacks;
            const resources = resourcePacks.map((name) => this.state.resource.domains.resourcepacks.find((pack) => `file/${pack.name}${pack.ext}` === name));

            const mcversion = version.minecraft;
            const resolvedMcVersion = ArtifactVersion.of(mcversion);

            const tree: Pick<IssueReport, 'incompatibleResourcePack'> = {
                incompatibleResourcePack: [],
            };

            const packFormatMapping = this.state.client.packFormatMapping.mcversion;
            for (const pack of resources) {
                if (!pack) continue;
                let metadata = pack.metadata as PackMeta.Pack;
                if (metadata.pack_format in packFormatMapping) {
                    const acceptVersion = packFormatMapping[metadata.pack_format];
                    const range = VersionRange.createFromVersionSpec(acceptVersion);
                    if (range && !range.containsVersion(resolvedMcVersion)) {
                        tree.incompatibleResourcePack.push({ name: pack.name, accepted: acceptVersion, actual: mcversion });
                    }
                }
            }

            Object.assign(report, tree);
        } finally {
            this.release('diagnose');
        }
    }

    @Singleton()
    async diagnoseUser(report: Partial<IssueReport>) {
        this.aquire('diagnose');
        try {
            const user = this.state.user.users[this.state.user.selectedUser.id];

            if (user) {
                const tree: Pick<IssueReport, 'missingAuthlibInjector'> = {
                    missingAuthlibInjector: [],
                };

                if (user.authService !== 'mojang' && user.authService !== 'offline') {
                    if (!await this.externalAuthSkinService.doesAuthlibInjectionExisted()) {
                        tree.missingAuthlibInjector.push({});
                    }
                }
                Object.assign(report, tree);
            }
        } finally {
            this.release('diagnose');
        }
    }

    @Singleton()
    async diagnoseCustomSkin(report: Partial<IssueReport>) {
        this.aquire('diagnose');
        try {
            const user = this.state.user.users[this.state.user.selectedUser.id];
            const tree: Pick<IssueReport, 'missingCustomSkinLoader'> = {
                missingCustomSkinLoader: [],
            };
            if (user.profileService !== 'mojang') {
                const instance = this.state.instance.all[this.state.instance.path];
                const { minecraft, fabricLoader, forge } = instance.runtime;
                if ((!forge && !fabricLoader) || forge) {
                    if (compareRelease(minecraft, '1.8.9') >= 0) {
                        // use forge by default
                        const res = this.state.instance.mods.find((r) => r.type === 'forge' && (r.metadata as any)[0].modid === 'customskinloader');
                        if (!res || !forge) {
                            tree.missingCustomSkinLoader.push({
                                target: 'forge',
                                skinService: user.profileService,
                                missingJar: !res,
                                noVersionSelected: !forge,
                            });
                        }
                    } else {
                        this.warn('Current support on custom skin loader forge does not support version below 1.8.9!');
                    }
                } else if (compareRelease(minecraft, '1.14') >= 0) {
                    const res = this.state.instance.mods.find((r) => r.type === 'fabric' && (r.metadata as any).id === 'customskinloader');
                    if (!res) {
                        tree.missingCustomSkinLoader.push({
                            target: 'fabric',
                            skinService: user.profileService,
                            missingJar: true,
                            noVersionSelected: false,
                        });
                    }
                } else {
                    this.warn('Current support on custom skin loader fabric does not support version below 1.14!');
                }
            }
            Object.assign(report, tree);
        } finally {
            this.release('diagnose');
        }
    }

    @Singleton()
    async diagnoseJava(report: Partial<IssueReport>) {
        this.aquire('diagnose');
        try {
            const instance = this.getters.instance;
            const instanceJava = this.getters.instanceJava;

            const mcversion = instance.runtime.minecraft;
            const resolvedMcVersion = ArtifactVersion.of(mcversion);

            const tree: Pick<IssueReport, 'incompatibleJava' | 'invalidJava' | 'missingJava'> = {
                incompatibleJava: [],
                missingJava: [],
                invalidJava: [],
            };

            if (instanceJava === EMPTY_JAVA) {
                tree.missingJava.push({});
            } else if (!instanceJava.valid || await missing(instanceJava.path)) {
                if (this.state.java.all.length === 0) {
                    tree.missingJava.push({});
                } else {
                    tree.invalidJava.push({ java: instanceJava.path });
                }
            } else if (instanceJava.majorVersion > 8) {
                if (!resolvedMcVersion.minorVersion || resolvedMcVersion.minorVersion < 13) {
                    tree.incompatibleJava.push({ java: instanceJava.version, version: mcversion, type: 'Minecraft' });
                } else if (resolvedMcVersion.minorVersion >= 13 && instance.runtime.forge && instanceJava.majorVersion > 10) {
                    tree.incompatibleJava.push({ java: instanceJava.version, version: instance.runtime.forge, type: 'MinecraftForge' });
                }
            }

            Object.assign(report, tree);
        } finally {
            this.release('diagnose');
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

        this.report(tree);
    }

    @Singleton()
    async diagnoseServer(report: Partial<IssueReport>) {
        this.aquire('diagnose');
        try {
            const stat = this.getters.instance.serverStatus;

            const tree: Pick<IssueReport, 'missingModsOnServer'> = {
                missingModsOnServer: [],
            };

            if (stat && stat.modinfo) {
                const info = stat.modinfo;
                tree.missingModsOnServer.push(...info.modList);
            }

            Object.assign(report, tree);
        } finally {
            this.release('diagnose');
        }
    }

    @Singleton()
    async diagnoseVersion(report: Partial<IssueReport>) {
        this.aquire('diagnose');
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

                'badInstall'>;

            let tree: VersionReport = {
                missingVersion: [],
                missingVersionJar: [],
                missingVersionJson: [],
                missingAssetsIndex: [],
                missingLibraries: [],
                missingAssets: [],

                corruptedVersionJar: [],
                corruptedAssetsIndex: [],
                corruptedVersionJson: [],
                corruptedLibraries: [],
                corruptedAssets: [],

                badInstall: [],
            };

            if (targetVersion === 'unknown') {
                tree.missingVersion.push({ ...currentVersion, version: getExpectVersion(currentVersion.minecraft, currentVersion.forge, currentVersion.liteloader, currentVersion.fabricLoader) });
            } else {
                this.log(`Diagnose for version ${targetVersion}`);

                let location = this.state.root;
                let gameReport = await Diagnosis.diagnose(targetVersion, location);

                for (let issue of gameReport.issues) {
                    if (issue.role === 'versionJson') {
                        if (issue.type === 'corrupted') {
                            tree.corruptedVersionJson.push({ version: issue.version, ...currentVersion, file: relative(this.state.root, issue.file), actual: issue.receivedChecksum, expect: issue.expectedChecksum });
                        } else {
                            tree.missingVersionJson.push({ version: issue.version, ...currentVersion, file: relative(this.state.root, issue.file) });
                        }
                    } else if (issue.role === 'minecraftJar') {
                        if (issue.type === 'corrupted') {
                            tree.corruptedVersionJar.push({ version: issue.version, ...currentVersion, file: relative(this.state.root, issue.file), actual: issue.receivedChecksum, expect: issue.expectedChecksum });
                        } else {
                            tree.missingVersionJar.push({ version: issue.version, ...currentVersion, file: relative(this.state.root, issue.file) });
                        }
                    } else if (issue.role === 'assetIndex') {
                        if (issue.type === 'corrupted') {
                            tree.corruptedAssetsIndex.push({ version: issue.version, file: relative(this.state.root, issue.file), actual: 'issue.receivedChecksum', expect: issue.expectedChecksum });
                        } else {
                            tree.missingAssetsIndex.push({ version: issue.version, file: relative(this.state.root, issue.file) });
                        }
                    } else if (issue.role === 'asset') {
                        if (issue.type === 'corrupted') {
                            tree.corruptedAssets.push({ ...issue.asset, version: currentVersion.minecraft, hash: issue.asset.hash, file: relative(this.state.root, issue.file), actual: issue.receivedChecksum, expect: issue.expectedChecksum });
                        } else {
                            tree.missingAssets.push({ ...issue.asset, version: currentVersion.minecraft, hash: issue.asset.hash, file: relative(this.state.root, issue.file) });
                        }
                    } else if (issue.role === 'library') {
                        if (issue.type === 'corrupted') {
                            tree.corruptedLibraries.push({ ...issue.library, file: relative(this.state.root, issue.file), actual: issue.receivedChecksum, expect: issue.expectedChecksum });
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
            Object.assign(report, tree);
        } finally {
            this.release('diagnose');
        }
    }

    /**
     * Report certain issues.
     * @param report The partial issue report
     */
    report(report: Partial<IssueReport>) {
        for (let [key, value] of Object.entries(report)) {
            let reg = this.state.diagnose.registry[key];
            if (value && reg.actived.length === 0 && value.length === 0) {
                delete report[key];
            }
        }
        this.commit('issuesPost', report);
    }

    /**
     * Fix all provided issues
     * @param issues The issues to be fixed.
     */
    async fix(issues: readonly Issue[]) {
        this.aquire('diagnose');
        try {
            const unfixed = issues.filter(p => p.autofix)
                .filter(p => !this.state.diagnose.registry[p.id].fixing);

            if (unfixed.length === 0) return;

            this.log(`Start fixing ${issues.length} issues: ${JSON.stringify(issues.map(i => i.id))}`);

            const recheck: Record<string, boolean> = {};

            this.commit('issuesStartResolve', unfixed);
            try {
                for (const fix of this.fixes) {
                    if (fix.match(issues)) {
                        await fix.fix(issues).catch(e => this.pushException({ type: 'issueFix', error: e }));
                        if (fix.recheck) {
                            recheck[fix.recheck] = true;
                        }
                    }
                }

                const report: Partial<IssueReport> = {};
                const self = this as any;
                for (const action of Object.keys(recheck)) {
                    if (action in self) { await self[action](report); }
                }
                this.report(report);
            } finally {
                this.commit('issuesEndResolve', unfixed);
            }
        } finally {
            this.release('diagnose');
        }
    }

    @Singleton()
    async fixNoJava() {
        this.aquire('diagnose');
        try {
            let internalLocation = this.javaService.getInternalJavaLocation();
            if (!this.state.java.all.find(j => j.path === internalLocation)) {
                await this.javaService.installDefaultJava();
            }
            await this.instanceService.editInstance({ java: this.javaService.getInternalJavaLocation() });
        } finally {
            this.release('diagnose');
        }
    }
}
