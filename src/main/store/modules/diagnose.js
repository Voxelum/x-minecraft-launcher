import { ArtifactVersion, VersionRange } from 'maven-artifact-version';
import { Forge, ForgeWebPage, Version } from '@xmcl/minecraft-launcher-core';
import base from 'universal/store/modules/diagnose';

/**
 * @type {import('universal/store/modules/diagnose').DiagnoseModule}
 */
const mod = {
    ...base,
    actions: {
        async save(context, { mutation, payload }) {
            // TODO: check if this works 
            if (context.rootState.profile.refreshing || mutation === 'refreshingProfile') return;
            context.commit('refreshingProfile', true);
            try {
                if (mutation === 'selectProfile') {
                    await context.dispatch('diagnoseFull');
                    return;
                }
                if (mutation === 'profile') {
                    if ('version' in payload) {
                        await context.dispatch('diagnoseFull');
                        return;
                    }

                    if ('java' in payload) {
                        await context.dispatch('diagnoseJava');
                    }
                    if ('deployments' in payload) {
                        if ('mods' in payload.deployments) {
                            await context.dispatch('diagnoseMods');
                        }
                        if ('resourcepacks' in payload.deployments) {
                            await context.dispatch('diagnoseResourcePacks');
                        }
                    }
                } else if (mutation === 'setUserProfile' || mutation === 'addUserProfile') {
                    await context.dispatch('diagnoseUser');
                } else if (mutation === 'serverStatus') {
                    await context.dispatch('diagnoseServer');
                }
            } finally {
                context.commit('refreshingProfile', false);
            }
        },
        async diagnoseMods(context) {
            const id = context.rootState.profile.id;
            const { version } = context.rootState.profile.all[id];
            const { mods } = context.rootGetters.deployingResources;
            if (!mods) return;

            const mcversion = version.minecraft;
            const resolvedMcVersion = ArtifactVersion.of(mcversion);
            const pattern = /^\[.+\]$/;

            /**
             * @type {Pick<import('universal/store/modules/diagnose').DiagnoseModule.ProblemReport, 'unknownMod' | 'incompatibleMod'>}
             */
            const tree = {
                unknownMod: [],
                incompatibleMod: [],
            };
            for (const mod of mods.filter(m => !!m && m.type === 'forge')) {
                /**
                 * @type {Forge.MetaData[]}
                 */
                const metadatas = mod.metadata;
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
            context.commit('postProblems', tree);
        },
        async diagnoseResourcePacks(context) {
            const id = context.rootState.profile.id;
            const { version } = context.rootState.profile.all[id];
            const { resourcepacks } = context.rootGetters.deployingResources;
            const mcversion = version.minecraft;
            const resolvedMcVersion = ArtifactVersion.of(mcversion);

            if (!resourcepacks) return;

            /**
             * @type {Pick<import('universal/store/modules/diagnose').DiagnoseModule.ProblemReport, 'incompatibleResourcePack'>}
             */
            const tree = {
                incompatibleResourcePack: [],
            };

            const packFormatMapping = context.rootState.client.packFormatMapping.mcversion;
            for (const pack of resourcepacks) {
                if (pack.metadata.format in packFormatMapping) {
                    const acceptVersion = packFormatMapping[pack.metadata.format];
                    const range = VersionRange.createFromVersionSpec(acceptVersion);
                    if (range && !range.containsVersion(resolvedMcVersion)) {
                        tree.incompatibleResourcePack.push({ name: pack.name, accepted: acceptVersion, actual: mcversion });
                    }
                }
            }

            context.commit('postProblems', tree);
        },
        async diagnoseUser(context) {
            const user = context.rootGetters.selectedUser;

            /**
             * @type {Pick<import('universal/store/modules/diagnose').DiagnoseModule.ProblemReport, 'missingAuthlibInjector'>}
             */
            const tree = {
                missingAuthlibInjector: [],
            };

            if (user.authService !== 'mojang' && user.authService !== 'offline') {
                const libs = await context.dispatch('listAuthlibs');
                if (libs.length === 0) {
                    tree.missingAuthlibInjector.push({});
                }
            }

            context.commit('postProblems', tree);
        },
        async diagnoseJava(context) {
            const id = context.rootState.profile.id;
            const profile = context.rootState.profile.all[id];

            const mcversion = profile.version.minecraft;
            const resolvedMcVersion = ArtifactVersion.of(mcversion);

            let java = profile.java;

            if (!java || !java.path || !java.majorVersion || !java.version) {
                console.log(`Fix java path ${JSON.stringify(java)}`);
                context.commit('profile', {
                    java: context.rootGetters.defaultJava,
                });
            }

            java = profile.java;

            /**
             * @type {Pick<import('universal/store/modules/diagnose').DiagnoseModule.ProblemReport, 'incompatibleJava'>}
             */
            const tree = {
                incompatibleJava: [],
            };

            if (java && java.majorVersion > 8) {
                if (!resolvedMcVersion.minorVersion || resolvedMcVersion.minorVersion < 13) {
                    tree.incompatibleJava.push({ java: java.version, mcversion });
                } else if (resolvedMcVersion.minorVersion >= 13 && profile.version.forge && java.majorVersion > 10) {
                    tree.incompatibleJava.push({ java: java.version, mcversion });
                }
            }

            context.commit('postProblems', tree);
        },
        async diagnoseServer(context) {
            const stat = context.rootState.profile.status;

            /**
             * @type {Pick<import('universal/store/modules/diagnose').DiagnoseModule.ProblemReport, 'missingModsOnServer'>}
             */
            const tree = {
                missingModsOnServer: [],
            };

            if (stat && stat.modinfo) {
                const info = stat.modinfo;
                tree.missingModsOnServer.push(...info.modList);
            }

            context.commit('postProblems', tree);
        },
        async diagnoseVersion(context) {
            const id = context.rootState.profile.id;
            const { version: versions } = context.rootState.profile.all[id];
            const currentVersion = context.rootGetters.currentVersion;
            const targetVersion = await context.dispatch('resolveVersion', currentVersion)
                .catch(() => currentVersion.id);

            console.log(`Diagnose for version ${targetVersion}`);

            /**
             * @type {Pick<import('universal/store/modules/diagnose').DiagnoseModule.ProblemReport, 
             *  'missingVersionJar' | 'missingAssetsIndex' | 'missingVersionJson' |'missingForgeJar'| 'missingLibraries' |
             *  'missingAssets' | 'missingVersion'>}
             */
            const tree = {
                missingVersion: [],
                missingVersionJar: [],
                missingAssetsIndex: [],
                missingVersionJson: [],
                missingForgeJar: [],
                missingLibraries: [],
                missingAssets: [],
            };
            const mcversion = versions.minecraft;
            if (!mcversion) {
                tree.missingVersion.push({});
            } else {
                const location = context.rootState.root;
                const versionDiagnosis = await Version.diagnose(targetVersion, location);

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

            context.commit('postProblems', tree);
        },
        async diagnoseFull(context) {
            // context.commit('refreshingProfile', true);
            await context.dispatch('diagnoseVersion');
            await context.dispatch('diagnoseJava');
            await context.dispatch('diagnoseMods');
            await context.dispatch('diagnoseResourcePacks');
            await context.dispatch('diagnoseServer');
            await context.dispatch('diagnoseUser');
            // context.commit('refreshingProfile', false);
        },
        async fixProfile(context, problems) {
            const unfixed = problems.filter(p => p.autofix)
                .filter(p => context.state.registry[p.id].fixing);

            if (unfixed.length === 0) return;

            const recheck = {};

            context.commit('startResolveProblems', unfixed);
            context.commit('refreshingProfile', true);

            const profile = context.rootGetters.selectedProfile;
            const { version: versions } = profile;
            const currentVersion = context.rootGetters.currentVersion;

            const mcversion = versions.minecraft;
            if (mcversion === '') {
                context.commit('refreshingProfile', false);
                context.commit('endResolveProblems', unfixed);
                return;
            }

            try {
                if (unfixed.some(p => p.id === 'missingVersion')) {
                    Reflect.set(recheck, 'diagnoseVersion', true);
                    context.commit('profile', { version: { minecraft: context.rootGetters.minecraftRelease.id } });
                }

                if (unfixed.some(p => p.id === 'missingVersionJar')) {
                    Reflect.set(recheck, 'diagnoseVersion', true);
                    const versionMeta = context.rootState.version.minecraft.versions.find(v => v.id === mcversion);
                    const handle = await context.dispatch('installMinecraft', versionMeta);
                    await context.dispatch('waitTask', handle);
                }

                if (unfixed.some(p => p.id === 'missingVersionJson')) {
                    Reflect.set(recheck, 'diagnoseVersion', true);
                    const mcvermeta = context.rootState.version.minecraft.versions.find(v => v.id === mcversion);
                    if (!mcvermeta) {
                        throw { error: 'missingVersionMeta', version: mcvermeta };
                    }
                    const mcInstallHandle = await context.dispatch('installMinecraft', mcvermeta);
                    await context.dispatch('waitTask', mcInstallHandle);
                    if (versions.forge) {
                        const forgeVersion = context.rootState.version.forge[mcversion];
                        if (!forgeVersion) {
                            throw new Error('unexpected');
                        }
                        const found = forgeVersion.versions.find(v => v.version === versions.forge);
                        if (found) {
                            const forge = ForgeWebPage.Version.to(found);
                            const handle = await context.dispatch('installForge', forge);
                            const fullVersion = await context.dispatch('waitTask', handle);
                            const depHandle = await context.dispatch('installDependencies', fullVersion);
                            await context.dispatch('waitTask', depHandle);
                        }
                    }
                    // TODO: support liteloader & fabric
                }

                const missingForgeJar = unfixed.find(p => p.id === 'missingForgeJar');
                if (missingForgeJar && missingForgeJar.arguments) {
                    const { minecraft, forge } = missingForgeJar.arguments;
                    const forgeVersion = context.rootState.version.forge[minecraft];
                    if (!forgeVersion) {
                        throw new Error('unexpected'); // TODO: handle this case
                    }
                    const forgeVer = forgeVersion.versions.find(v => v.version === forge);
                    if (!forgeVer) {
                        console.error('Unexpected missing forge context for missingForgeJar problem');
                    } else {
                        Reflect.set(recheck, 'diagnoseVersion', true);
                        const forgeMeta = ForgeWebPage.Version.to(forgeVer);
                        const handle = await context.dispatch('installForge', forgeMeta);
                        await context.dispatch('waitTask', handle);
                    }
                }

                if (unfixed.some(p => ['missingAssetsIndex', 'missingAssets'].indexOf(p.id) !== -1)) {
                    try {
                        Reflect.set(recheck, 'diagnoseVersion', true);
                        const targetVersion = await context.dispatch('resolveVersion', currentVersion);
                        const handle = await context.dispatch('installAssets', targetVersion);
                        await context.dispatch('waitTask', handle);
                    } catch {
                        console.error('Cannot fix assetes');
                    }
                }
                const missingLibs = unfixed.find(p => p.id === 'missingLibraries');
                if (missingLibs && missingLibs.arguments && missingLibs.arguments.libraries) {
                    Reflect.set(recheck, 'diagnoseVersion', true);
                    const handle = await context.dispatch('installLibraries', { libraries: missingLibs.arguments.libraries });
                    await context.dispatch('waitTask', handle);
                }

                if (unfixed.find(p => p.id === 'missingAuthlibInjector')) {
                    Reflect.set(recheck, 'diagnoseServer', true);
                    await context.dispatch('ensureAuthlibInjection');
                }

                for (const action of Object.keys(recheck)) {
                    // @ts-ignore
                    await context.dispatch(action);
                }
            } catch (e) {
                console.error(e);
            } finally {
                context.commit('endResolveProblems', unfixed);
                context.commit('refreshingProfile', false);
            }
        },


    },
};

export default mod;
