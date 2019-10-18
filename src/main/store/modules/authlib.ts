import { Installer, MinecraftFolder, Net, Version } from "@xmcl/minecraft-launcher-core";
import Task from "@xmcl/task";
import { fs } from "main/utils";
import { AuthLibModule } from "universal/store/modules/authlib";

const AUTHLIB_ORG_NAME = 'org.to2mbn:authlibinjector';

const mod: AuthLibModule = {
    actions: {
        async doesAuthlibInjectionExisted(context) {
            const jsonPath = context.rootGetters.path('authlib-injection.json');
            const mc = new MinecraftFolder(context.rootState.root);
            let content = await fs.readFile(jsonPath).then((b) => JSON.parse(b.toString())).catch(_ => undefined);
            if (!content) return false;
            const info = Version.getLibraryInfo(`${AUTHLIB_ORG_NAME}:${content.version}`);
            const libPath = mc.getLibraryByPath(info.path);
            return await fs.validate(libPath, { algorithm: 'sha256', hash: content.checksums.sha256 });
        },
        async ensureAuthlibInjection(context) {
            const task = Task.create('installAuthlibInjector', async (ctx) => {
                const jsonPath = context.rootGetters.path('authlib-injection.json');
                const mc = new MinecraftFolder(context.rootState.root);

                let content = await fs.readFile(jsonPath).then((b) => JSON.parse(b.toString())).catch(_ => undefined);
                if (!content) {
                    const { body, statusCode, statusMessage } = await Net.fetchJson('https://authlib-injector.yushi.moe/artifact/latest.json');
                    if (statusCode !== 200) throw new Error(statusMessage);
                    const path = await download(body);
                    return path;
                }

                const info = Version.getLibraryInfo(`${AUTHLIB_ORG_NAME}:${content.version}`);
                const libPath = mc.getLibraryByPath(info.path);
                if (await fs.validate(libPath, { algorithm: 'sha256', hash: content.checksums.sha256 })) {
                    return libPath;
                }

                return download(content);

                async function download(content: any) {
                    const name = `${AUTHLIB_ORG_NAME}:${content.version}`;
                    const info = Version.getLibraryInfo(name);
                    const authlib: Version.Library = {
                        name,
                        downloads: {
                            artifact: {
                                sha1: '',
                                size: -1,
                                path: info.path,
                                url: content.download_url,
                            }
                        }
                    }
                    await Installer.installLibrariesDirectTask(Version.resolveLibraries([authlib]), context.rootState.root).work(ctx);
                    return mc.getLibraryByPath(info.path);
                }
            });
            const dest = await context.dispatch('waitTask', await context.dispatch('executeTask', task));
            await context.dispatch('diagnoseUser');
            return dest;
        }
    },
};

export default mod;