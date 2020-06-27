import { AUTHLIB_ORG_NAME } from '@main/constant';
import { validateSha256 } from '@main/util/fs';
import { IssueReport } from '@universal/store/modules/diagnose';
import { LibraryInfo, MinecraftFolder, Version } from '@xmcl/core';
import { Installer } from '@xmcl/installer';
import { Task } from '@xmcl/task';
import { readJson } from 'fs-extra';
import DiagnoseService from './DiagnoseService';
import Service, { Inject } from './Service';

export default class AuthLibService extends Service {
    @Inject('DiagnoseService')
    private diagnoseService!: DiagnoseService;

    async doesAuthlibInjectionExisted(): Promise<boolean> {
        const jsonPath = this.getPath('authlib-injection.json');
        const mc = new MinecraftFolder(this.state.root);
        const content = await readJson(jsonPath).catch(() => undefined);
        if (!content) return false;
        const info = LibraryInfo.resolve(`${AUTHLIB_ORG_NAME}:${content.version}`);
        const libPath = mc.getLibraryByPath(info.path);
        return validateSha256(libPath, content.checksums.sha256);
    }

    async ensureAuthlibInjection(): Promise<string> {
        const installAuthlibInjector = Task.create('installAuthlibInjector', async (ctx: Task.Context) => {
            const jsonPath = this.getPath('authlib-injection.json');
            const mc = new MinecraftFolder(this.state.root);
            const root = this.state.root;

            async function download(content: any) {
                const name = `${AUTHLIB_ORG_NAME}:${content.version}`;
                const info = LibraryInfo.resolve(name);
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
                await Installer.installResolvedLibrariesTask(Version.resolveLibraries([authlib]), root).run(ctx);
                return mc.getLibraryByPath(info.path);
            }

            const content = await readJson(jsonPath).catch(() => undefined);
            if (!content) {
                const { body, statusCode, statusMessage } = await this.networkManager.request('https://authlib-injector.yushi.moe/artifact/latest.json', { responseType: 'default' });
                if (statusCode !== 200) throw new Error(statusMessage);
                const path = await download(body);
                return path;
            }

            const info = LibraryInfo.resolve(`${AUTHLIB_ORG_NAME}:${content.version}`);
            const libPath = mc.getLibraryByPath(info.path);
            if (await validateSha256(libPath, content.checksums.sha256)) {
                return libPath;
            }

            return download(content);
        });
        const dest = await this.submit(installAuthlibInjector).wait();

        let report: Partial<IssueReport> = {};
        this.diagnoseService.diagnoseUser(report);
        this.diagnoseService.report(report);

        return dest as string;
    }
}
