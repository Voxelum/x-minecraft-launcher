import { MinecraftFolder, ResolvedLibrary } from '@xmcl/core';
import { Diagnosis, ForgeInstaller, Installer } from '@xmcl/installer';
import { Status } from '@xmcl/installer/diagnose';
import { Forge } from '@xmcl/mod-parser';
import { Task } from '@xmcl/task';
import { ArtifactVersion, VersionRange } from 'maven-artifact-version';
import { Issue, IssueReport } from '@universal/store/modules/diagnose';
import { LocalVersion } from '@universal/store/modules/version';
import AuthLibService from './AuthLibService';
import InstallService from './InstallService';
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
        this.registerMatchedFix(['missingVersionJson', 'missingVersionJar'],
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

        this.registerMatchedFix(['badForgeProcessedFiles'],
            async (issues) => {
                const { folder } = this.getters.instanceVersion;
                // const postProcessing = Task.create('postProcessing', async (cc: Task.Context) => {
                //     const root = new MinecraftFolder(this.state.root);
                //     const total = issues.length;
                //     let i = 0;
                //     cc.update(i, total);
                //     for (const proc of issues) {
                //         await ForgeInstaller.postProcess(root, proc.arguments as any, JavaExecutor.createSimple(this.getters.defaultJava.path));
                //         cc.update(i += 1);
                //     }
                // });
                // const installForge = Task.create('installForge', async (c: Task.Context) => {
                //     try {
                //         await c.execute(postProcessing);
                //     } catch (e) {
                //         await Installer.installByProfileTask(
                //             folder,
                //             this.state.root,
                //             {
                //                 java: JavaExecutor.createSimple(this.getters.defaultJava.path),
                //             },
                //         ).run(c);
                //     }
                // });
                // await this.submit(installForge).wait();
            },
            'diagnoseVersion');

        this.registerMatchedFix(['missingForgeJar'],
            async (issues) => {
                if (!issues[0].arguments) return;
                const { minecraft, forge } = issues[0].arguments;
                const forgeVer = this.state.version.forge[minecraft]?.versions.find(v => v.version === forge);
                if (!forgeVer) {
                    this.pushException({ type: 'fixVersionNoForgeVersionMetadata', minecraft, forge });
                    this.error('Unexpected missing forge context for missingForgeJar problem');
                } else {
                    const forgeMeta = forgeVer;
                    await this.installService.installForge(forgeMeta);
                }
            },
            'diagnoseVersion');

        this.registerMatchedFix(['missingAssetsIndex', 'missingAssets'],
            (issues) => this.installService.installAssets(issues[0].arguments!.version),
            'diagnoseVersion');

        this.registerMatchedFix(['missingLibraries'],
            async (issues) => {
                if (!issues[0].arguments) return;
                if (issues[0].arguments.libraries instanceof Array) {
                    await this.installService.installLibraries({ libraries: issues[0].arguments.libraries });
                } else {
                    const all = issues.filter(p => p.id === 'missingLibraries');
                    await this.installService.installLibraries({ libraries: all.map(p => p.arguments as ResolvedLibrary) });
                }
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
                    tree.incompatibleJava.push({ java: resolvedJava.version, mcversion });
                } else if (resolvedMcVersion.minorVersion >= 13 && instance.runtime.forge && resolvedJava.majorVersion > 10) {
                    tree.incompatibleJava.push({ java: resolvedJava.version, mcversion });
                }
            }

            this.commit('issuesPost', tree);
        } finally {
            this.commit('release', 'diagnose');
        }
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
            const id = this.state.instance.path;
            const selected = this.state.instance.all[id];
            if (!selected) {
                this.error(`No profile selected! ${id}`);
                return;
            }
            await this.versionService.refreshVersions();
            const currentVersion = { ...this.getters.instanceVersion };
            let targetVersion = currentVersion.folder;
            const mcversion = currentVersion.minecraft;

            type VersionReport = Pick<IssueReport, 'missingVersionJar' | 'missingAssetsIndex' | 'missingVersionJson' | 'missingForgeJar' | 'missingLibraries' | 'missingAssets' | 'missingVersion'
                | 'corruptedVersionJar' | 'corruptedAssetsIndex' | 'corruptedVersionJson' | 'corruptedForgeJar' | 'corruptedLibraries' | 'corruptedAssets'
                | 'badForgeProcessedFiles' | 'badForge' | 'badForgeIncomplete'>;

            const tree: VersionReport = {
                missingVersion: [],
                missingVersionJar: [],
                missingAssetsIndex: [],
                missingVersionJson: [],
                missingForgeJar: [],
                missingLibraries: [],
                missingAssets: [],

                corruptedVersionJar: [],
                corruptedAssetsIndex: [],
                corruptedVersionJson: [],
                corruptedForgeJar: [],
                corruptedLibraries: [],
                corruptedAssets: [],

                badForge: [],
                badForgeIncomplete: [],
                badForgeProcessedFiles: [],
            };

            if (targetVersion === 'unknown') {
                targetVersion = mcversion;
                // this.log(`Skip diagnose for unknown version ${mcversion}`);
                // return;
            }
            this.log(`Diagnose for version ${targetVersion}`);

            const location = this.state.root;
            const versionDiagnosis = await Diagnosis.diagnose(targetVersion, location);

            if (versionDiagnosis.versionJson.status === Status.Corrupted) {
                tree.corruptedVersionJson.push({ version: versionDiagnosis.versionJson.value, ...currentVersion });
            } else if (versionDiagnosis.versionJson.status === Status.Missing || versionDiagnosis.versionJson.status === Status.Unknown) {
                tree.missingVersionJson.push({ version: versionDiagnosis.versionJson.value, ...currentVersion });
            }

            if (versionDiagnosis.versionJar === Status.Corrupted) {
                tree.corruptedVersionJar.push({ version: mcversion, ...currentVersion });
            } else if (versionDiagnosis.versionJar === Status.Missing) {
                tree.missingVersionJar.push({ version: mcversion, ...currentVersion });
            }

            if (versionDiagnosis.assetsIndex === Status.Corrupted) {
                tree.corruptedAssetsIndex.push({ version: mcversion });
            } else if (versionDiagnosis.assetsIndex === Status.Missing) {
                tree.missingAssetsIndex.push({ version: mcversion });
            }

            if (versionDiagnosis.libraries.length !== 0) {
                const missingForge = versionDiagnosis.libraries.find(l => l.value.name.startsWith('net.minecraftforge:forge'));
                if (missingForge) {
                    const [minecraft, forge] = missingForge.value.name.substring('net.minecraftforge:forge:'.length).split('-');
                    tree.missingForgeJar.push({ minecraft, forge });
                }

                tree.missingLibraries.push(...versionDiagnosis.libraries
                    .filter(l => l.status === Status.Missing)
                    .filter(l => !l.value.name.startsWith('net.minecraftforge:forge'))
                    .map(l => l.value));

                tree.corruptedLibraries.push(...versionDiagnosis.libraries
                    .filter(l => l.status === Status.Corrupted)
                    .filter(l => !l.value.name.startsWith('net.minecraftforge:forge'))
                    .map(l => l.value));
            }
            if (versionDiagnosis.assets.length !== 0) {
                const missing = versionDiagnosis.assets.filter(a => a.status === Status.Missing);
                if (missing.length !== 0) {
                    tree.missingAssets.push({ count: missing.length, version: targetVersion });
                }
                const corrupted = versionDiagnosis.assets.filter(a => a.status === Status.Corrupted);
                if (corrupted.length !== 0) {
                    tree.missingAssets.push({ count: corrupted.length, version: targetVersion });
                }
            }
            if (versionDiagnosis.forge) {
                const forgeDiagnosis = versionDiagnosis.forge;
                if (!forgeDiagnosis.badVersionJson) {
                    if (forgeDiagnosis.badInstall) {
                        tree.badForge.push({ forge: currentVersion.forge, minecraft: currentVersion.minecraft });
                    } else if (forgeDiagnosis.libraries.length !== 0) {
                        tree.badForgeIncomplete.push({
                            count: forgeDiagnosis.libraries.length,
                            libraries: forgeDiagnosis.libraries.map(l => l.value),
                        });
                    } else if (forgeDiagnosis.unprocessed.length !== 0) {
                        tree.badForgeProcessedFiles.push(...forgeDiagnosis.unprocessed);
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
}
