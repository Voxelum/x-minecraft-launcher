/**
 * @type {import('./diagnose').DiagnoseModule}
 */
const mod = {
    state: {
        registry: {
            missingVersion: { fixing: false, autofix: true, optional: false, actived: [] },
            missingVersionJar: { fixing: false, autofix: true, optional: false, actived: [] },
            missingAssetsIndex: { fixing: false, autofix: true, optional: false, actived: [] },
            missingVersionJson: { fixing: false, autofix: true, optional: false, actived: [] },
            missingForgeJar: { fixing: false, autofix: true, optional: false, actived: [] },
            missingLibraries: { fixing: false, autofix: true, optional: false, actived: [] },
            missingAssets: { fixing: false, autofix: true, optional: false, actived: [] },
            unknownMod: { fixing: false, autofix: false, optional: true, actived: [] },
            incompatibleMod: { fixing: false, autofix: false, optional: true, actived: [] },
            incompatibleResourcePack: { fixing: false, autofix: false, optional: true, actived: [] },
            missingAuthlibInjector: { fixing: false, autofix: true, optional: false, actived: [] },
            incompatibleJava: { fixing: false, autofix: true, optional: false, actived: [] },
        },
    },
    getters: {
        problems(state) {
            /**
             * @type {import('./diagnose').DiagnoseModule.Problem[]}
             */
            const problems = [];

            for (const [id, reg] of Object.entries(state.registry)) {
                if (reg.actived.length === 0) continue;
                if (id === 'missingLibraries' && reg.actived.length >= 3) {
                    problems.push({
                        id,
                        arguments: { count: reg.actived.length },
                        autofix: reg.autofix,
                        optional: reg.optional,
                    });
                } else {
                    problems.push(...reg.actived.map(a => ({
                        id,
                        arguments: a,
                        autofix: reg.autofix,
                        optional: reg.optional,
                    })));
                }
            }

            return problems;
        },
    },
    mutations: {
        postProblems(state, problems) {
            for (const [id, value] of Object.entries(problems)) {
                if (value instanceof Array) {
                    state.registry[id].actived = value;
                }
            }
        },
        startResolveProblems(state, problems) {
            problems.forEach((p) => {
                state.registry[p.id].fixing = true;
            });
        },
        endResolveProblems(state, problems) {
            problems.forEach((p) => {
                state.registry[p.id].fixing = false;
            });
        },
    },
};

export default mod;
