import { Installer, MinecraftFolder, Net, Version } from '@xmcl/minecraft-launcher-core';
import Task from '@xmcl/task';
import { fs } from 'main/utils';
import { AUTHLIB_ORG_NAME } from 'universal/utils/constant';
import Service, { Inject } from './Service';
import DiagnoseService from './DiagnoseService';

export default class AuthLibService extends Service {
    @Inject('DiagnoseService')
    private diagnoseService!: DiagnoseService;

    async doesAuthlibInjectionExisted(): Promise<boolean> {
        const jsonPath = this.getPath('authlib-injection.json');
        const mc = new MinecraftFolder(this.state.root);
        const content = await fs.readFile(jsonPath).then(b => JSON.parse(b.toString())).catch(_ => undefined);
        if (!content) return false;
        const info = Version.getLibraryInfo(`${AUTHLIB_ORG_NAME}:${content.version}`);
        const libPath = mc.getLibraryByPath(info.path);
        return await fs.validate(libPath, { algorithm: 'sha256', hash: content.checksums.sha256 });
    }

    async ensureAuthlibInjection(): Promise<string> {
        const installAuthlibInjector = async (ctx: Task.Context) => {
            const jsonPath = this.getPath('authlib-injection.json');
            const mc = new MinecraftFolder(this.state.root);

            const content = await fs.readFile(jsonPath).then(b => JSON.parse(b.toString())).catch(_ => undefined);
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
            const root = this.state.root;

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
                        },
                    },
                };
                await Installer.installLibrariesDirectTask(Version.resolveLibraries([authlib]), root)(ctx);
                return mc.getLibraryByPath(info.path);
            }
        };
        const dest = await this.submit(installAuthlibInjector).wait();
        this.diagnoseService.diagnoseUser();
        return dest as string;
    }
}
