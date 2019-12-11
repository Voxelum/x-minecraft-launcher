import { Forge, ForgeInstaller, ForgeWebPage, Installer, JavaExecutor, MinecraftFolder, ResolvedLibrary, Task } from '@xmcl/minecraft-launcher-core';
import { ArtifactVersion, VersionRange } from 'maven-artifact-version';
import { Problem, ProblemReport } from 'universal/store/modules/diagnose';
import AuthLibService from './AuthLibService';
import Service, { Inject } from './Service';
import VersionInstallService from './VersionInstallService';
import VersionService from './VersionService';

export default class DiagnoseService extends Service {
    @Inject('VersionService')
    private local!: VersionService;

    @Inject('VersionInstallService')
    private install!: VersionInstallService;

    @Inject('AuthLibService')
    private authLibService!: AuthLibService;

    async save({ mutation, payload }: { mutation: string; payload: any }) {
        // TODO: check if this works
        if (this.getters.busy('diagnose') || mutation === 'release' || mutation === 'aquire') return;
        if (mutation === 'selectProfile') {
            this.commit('aquire', 'diagnose');
            await this.diagnoseVersion();
            await this.diagnoseJava();
            await this.diagnoseMods();
            await this.diagnoseResourcePacks();
            await this.diagnoseServer();
            this.commit('release', 'diagnose');
        } else if (mutation === 'profile') {
            if ('version' in payload) {
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
        } else if (mutation === 'setUserProfile') {
            await this.diagnoseUser();
        } else if (mutation === 'serverStatus') {
            await this.diagnoseServer();
        }
    }

    async init() {
        this.commit('aquire', 'diagnose');
        try {
            console.log('Init with a full diagnose');
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

    async diagnoseMods() {
        this.commit('aquire', 'diagnose');
        try {
            const id = this.state.profile.id;
            const { version } = this.state.profile.all[id];
            const { mods } = this.getters.deployingResources;
            if (!mods) return;

            const mcversion = version.minecraft;
            const resolvedMcVersion = ArtifactVersion.of(mcversion);
            const pattern = /^\[.+\]$/;

            const tree: Pick<ProblemReport, 'unknownMod' | 'incompatibleMod'> = {
                unknownMod: [],
                incompatibleMod: [],
            };
            for (const mod of mods.filter(m => !!m && m.type === 'forge')) {
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
            this.commit('postProblems', tree);
        } finally {
            this.commit('release', 'diagnose');
        }
    }

    async diagnoseResourcePacks() {
        this.commit('aquire', 'diagnose');
        try {
            const id = this.state.profile.id;
            const { version } = this.state.profile.all[id];
            const { resourcepacks } = this.getters.deployingResources;
            const mcversion = version.minecraft;
            const resolvedMcVersion = ArtifactVersion.of(mcversion);

            if (!resourcepacks) return;

            const tree: Pick<ProblemReport, 'incompatibleResourcePack'> = {
                incompatibleResourcePack: [],
            };

            const packFormatMapping = this.state.client.packFormatMapping.mcversion;
            for (const pack of resourcepacks) {
                if (pack.metadata.format in packFormatMapping) {
                    const acceptVersion = packFormatMapping[pack.metadata.format];
                    const range = VersionRange.createFromVersionSpec(acceptVersion);
                    if (range && !range.containsVersion(resolvedMcVersion)) {
                        tree.incompatibleResourcePack.push({ name: pack.name, accepted: acceptVersion, actual: mcversion });
                    }
                }
            }

            this.commit('postProblems', tree);
        } finally {
            this.commit('release', 'diagnose');
        }
    }

    async diagnoseUser() {
        this.commit('aquire', 'diagnose');
        try {
            const user = this.getters.selectedUser;

            const tree: Pick<ProblemReport, 'missingAuthlibInjector'> = {
                missingAuthlibInjector: [],
            };

            if (user.authService !== 'mojang' && user.authService !== 'offline') {
                if (!await this.authLibService.doesAuthlibInjectionExisted()) {
                    tree.missingAuthlibInjector.push({});
                }
            }

            this.commit('postProblems', tree);
        } finally {
            this.commit('release', 'diagnose');
        }
    }

    async diagnoseJava() {
        this.commit('aquire', 'diagnose');
        try {
            const id = this.state.profile.id;
            const profile = this.state.profile.all[id];

            const mcversion = profile.version.minecraft;
            const resolvedMcVersion = ArtifactVersion.of(mcversion);

            let java = profile.java;

            if (!java || !java.path || !java.majorVersion || !java.version) {
                console.log(`Fix java path ${JSON.stringify(java)}`);
                this.commit('profile', {
                    java: this.getters.defaultJava,
                });
            }

            java = profile.java;

            const tree: Pick<ProblemReport, 'incompatibleJava'> = {
                incompatibleJava: [],
            };

            if (java && java.majorVersion > 8) {
                if (!resolvedMcVersion.minorVersion || resolvedMcVersion.minorVersion < 13) {
                    tree.incompatibleJava.push({ java: java.version, mcversion });
                } else if (resolvedMcVersion.minorVersion >= 13 && profile.version.forge && java.majorVersion > 10) {
                    tree.incompatibleJava.push({ java: java.version, mcversion });
                }
            }

            this.commit('postProblems', tree);
        } finally {
            this.commit('release', 'diagnose');
        }
    }

    async diagnoseServer() {
        this.commit('aquire', 'diagnose');
        try {
            const stat = this.state.profile.statuses[this.state.profile.id];

            const tree: Pick<ProblemReport, 'missingModsOnServer'> = {
                missingModsOnServer: [],
            };

            if (stat && stat.modinfo) {
                const info = stat.modinfo;
                tree.missingModsOnServer.push(...info.modList);
            }

            this.commit('postProblems', tree);
        } finally {
            this.commit('release', 'diagnose');
        }
    }

    async diagnoseVersion() {
        this.commit('aquire', 'diagnose');
        try {
            const id = this.state.profile.id;
            const selected = this.state.profile.all[id];
            if (!selected) {
                console.error(`No profile selected! ${id}`);
                return;
            }
            const { version: versions } = selected;
            const currentVersion = this.getters.currentVersion;
            const targetVersion = await this.local.resolveVersion(currentVersion)
                .catch(() => currentVersion.id);

            console.log(`Diagnose for version ${targetVersion}`);

            const tree: Pick<ProblemReport,
                'missingVersionJar' | 'missingAssetsIndex' | 'missingVersionJson' | 'missingForgeJar' | 'missingLibraries' |
                'missingAssets' | 'missingVersion' | 'badForgeProcessedFiles' | 'badForge' | 'badForgeIncomplete'> = {
                    missingVersion: [],
                    missingVersionJar: [],
                    missingAssetsIndex: [],
                    missingVersionJson: [],
                    missingForgeJar: [],
                    missingLibraries: [],
                    missingAssets: [],
                    badForge: [],
                    badForgeIncomplete: [],
                    badForgeProcessedFiles: [],
                };
            const mcversion = versions.minecraft;
            if (!mcversion) {
                tree.missingVersion.push({});
            } else {
                const location = this.state.root;
                const versionDiagnosis = await Installer.diagnose(targetVersion, location);

                if (versionDiagnosis.missingVersionJar) {
                    tree.missingVersionJar.push({ version: mcversion });
                }
                if (versionDiagnosis.missingAssetsIndex) {
                    tree.missingAssetsIndex.push({ version: mcversion });
                }
                if (versionDiagnosis.missingVersionJson !== '') {
                    tree.missingVersionJson.push({ version: versionDiagnosis.missingVersionJson });
                }
                if (versionDiagnosis.missingLibraries.length !== 0) {
                    const missingForge = versionDiagnosis.missingLibraries.find(l => l.name.startsWith('net.minecraftforge:forge'));
                    if (missingForge) {
                        const [minecraft, forge] = missingForge.name.substring('net.minecraftforge:forge:'.length).split('-');
                        tree.missingForgeJar.push({ minecraft, forge });
                    }

                    tree.missingLibraries.push(...versionDiagnosis.missingLibraries
                        .filter(l => !l.name.startsWith('net.minecraftforge:forge')));
                }
                const missingAssets = Object.keys(versionDiagnosis.missingAssets);
                if (missingAssets.length !== 0) {
                    tree.missingAssets.push({ count: missingAssets.length });
                }
            }

            const mcArt = ArtifactVersion.parseVersion(currentVersion.minecraft);
            if (currentVersion.forge && mcArt.minorVersion && mcArt.minorVersion >= 13) {
                // TODO: handle cases if liteloader existed
                const diagnosis = await ForgeInstaller.diagnoseForgeVersion(targetVersion, this.state.root);
                if (!diagnosis.badVersionJson) {
                    if (diagnosis.badInstall) {
                        tree.badForge.push({ forge: currentVersion.forge, minecraft: currentVersion.minecraft });
                    } else if (diagnosis.missingInstallDependencies.length !== 0) {
                        tree.badForgeIncomplete.push({ count: diagnosis.missingInstallDependencies.length, libraries: diagnosis.missingInstallDependencies });
                    } else if (diagnosis.badProcessedFiles.length !== 0) {
                        tree.badForgeProcessedFiles.push(...diagnosis.badProcessedFiles);
                    }
                }
            }

            this.commit('postProblems', tree);
        } finally {
            this.commit('release', 'diagnose');
        }
    }

    async fixProfile(problems: readonly Problem[]) {
        const unfixed = problems.filter(p => p.autofix)
            .filter(p => !this.state.diagnose.registry[p.id].fixing);

        if (unfixed.length === 0) return;

        const recheck = {};

        this.commit('startResolveProblems', unfixed);
        this.commit('aquire', 'diagnose');

        const profile = this.getters.selectedProfile;
        const { version: versions } = profile;
        const currentVersion = this.getters.currentVersion;

        const mcversion = versions.minecraft;
        if (mcversion === '') {
            this.commit('release', 'diagnose');
            this.commit('endResolveProblems', unfixed);
            return;
        }

        try {
            if (unfixed.some(p => p.id === 'missingVersion')) {
                Reflect.set(recheck, 'diagnoseVersion', true);
                this.commit('profile', { version: { minecraft: this.getters.minecraftRelease.id } });
            }

            if (unfixed.some(p => p.id === 'missingVersionJar')) {
                Reflect.set(recheck, 'diagnoseVersion', true);
                const versionMeta = this.state.version.minecraft.versions.find(v => v.id === mcversion);
                await this.install.installMinecraft(versionMeta!);
            }

            if (unfixed.some(p => p.id === 'missingVersionJson')) {
                Reflect.set(recheck, 'diagnoseVersion', true);
                const mcvermeta = this.state.version.minecraft.versions.find(v => v.id === mcversion);
                if (!mcvermeta) {
                    throw { error: 'MissingVersionMeta', version: mcvermeta };
                }
                await this.install.installMinecraft(mcvermeta);
                if (versions.forge) {
                    const forgeVersion = this.state.version.forge[mcversion];
                    if (!forgeVersion) {
                        throw new Error('unexpected');
                    }
                    const found = forgeVersion.versions.find(v => v.version === versions.forge);
                    if (found) {
                        const forge = ForgeWebPage.Version.to(found);
                        const fullVersion = await this.install.installForge(forge);
                        if (fullVersion) {
                            await this.install.installDependencies(fullVersion);
                        }
                    }
                }
                // TODO: support liteloader & fabric
            }

            const badForgeProcessedFiles = unfixed.filter(p => p.id === 'badForgeProcessedFiles');
            if (badForgeProcessedFiles.length > 0) {
                Reflect.set(recheck, 'diagnoseVersion', true);
                const targetVersion = await this.local.resolveVersion(currentVersion)
                    .catch(() => currentVersion.id);
                const postProcessing = async (cc: Task.Context) => {
                    const root = new MinecraftFolder(this.state.root);
                    const total = badForgeProcessedFiles.length;
                    let i = 0;
                    cc.update(i, total);
                    for (const proc of badForgeProcessedFiles) {
                        await ForgeInstaller.postProcess(root, proc.arguments as any, JavaExecutor.createSimple(this.getters.defaultJava.path));
                        cc.update(i += 1);
                    }
                };
                const installForge = async (c: Task.Context) => {
                    try {
                        await c.execute(postProcessing);
                    } catch (e) {
                        await ForgeInstaller.installByInstallerPartialTask(
                            targetVersion,
                            this.state.root,
                            {
                                java: JavaExecutor.createSimple(this.getters.defaultJava.path),
                            },
                        )(c);
                    }
                };
                await this.submit(installForge).wait();
            }

            const missingForgeJar = unfixed.find(p => p.id === 'missingForgeJar');
            if (missingForgeJar && missingForgeJar.arguments) {
                const { minecraft, forge } = missingForgeJar.arguments;
                const forgeVersion = this.state.version.forge[minecraft];
                if (!forgeVersion) {
                    throw new Error('unexpected'); // TODO: handle this case
                }
                const forgeVer = forgeVersion.versions.find(v => v.version === forge);
                if (!forgeVer) {
                    console.error('Unexpected missing forge context for missingForgeJar problem');
                } else {
                    Reflect.set(recheck, 'diagnoseVersion', true);
                    const forgeMeta = ForgeWebPage.Version.to(forgeVer);
                    await this.install.installForge(forgeMeta);
                }
            }

            if (unfixed.some(p => ['missingAssetsIndex', 'missingAssets'].indexOf(p.id) !== -1)) {
                try {
                    Reflect.set(recheck, 'diagnoseVersion', true);
                    const targetVersion = await this.local.resolveVersion(currentVersion);
                    await this.install.installAssets(targetVersion);
                } catch {
                    console.error('Cannot fix assetes');
                }
            }
            const missingLibs = unfixed.find(p => p.id === 'missingLibraries');
            if (missingLibs && missingLibs.arguments) {
                Reflect.set(recheck, 'diagnoseVersion', true);
                if (missingLibs.arguments.libraries instanceof Array) {
                    await this.install.installLibraries({ libraries: missingLibs.arguments.libraries });
                } else {
                    const all = unfixed.filter(p => p.id === 'missingLibraries');
                    await this.install.installLibraries({ libraries: all.map(p => p.arguments as ResolvedLibrary) });
                }
            }

            if (unfixed.find(p => p.id === 'missingAuthlibInjector')) {
                Reflect.set(recheck, 'diagnoseServer', true);
                await this.authLibService.ensureAuthlibInjection();
            }
        } catch (e) {
            console.error(e);
        } finally {
            this.commit('endResolveProblems', unfixed);
            this.commit('release', 'diagnose');
            for (const action of Object.keys(recheck)) {
                const self = this as any;
                if (action in self) {
                    self[action]();
                }
                // await dispatch(action);
            }
        }
    }
}
