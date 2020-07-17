import { AUTHLIB_ORG_NAME } from '@main/constant';
import { validateSha256 } from '@main/util/fs';
import { IssueReport } from '@universal/store/modules/diagnose';
import { LibraryInfo, MinecraftFolder, Version } from '@xmcl/core';
import { Installer } from '@xmcl/installer';
import { Task } from '@xmcl/task';
import { createWriteStream, readJson, writeFile, ensureFile } from 'fs-extra';
import { pipeline } from 'stream';
import DiagnoseService from './DiagnoseService';
import ResourceService from './ResourceService';
import Service, { Inject } from './Service';

export default class ExternalAuthSkinService extends Service {
    @Inject('DiagnoseService')
    private diagnoseService!: DiagnoseService;

    @Inject('ResourceService')
    private resourceService!: ResourceService;

    async downloadCustomSkinLoader(type: 'forge' | 'fabric' = 'forge') {
        const url = type === 'forge'
            ? 'https://github.com/xfl03/MCCustomSkinLoader/releases/download/14.12/CustomSkinLoader_Forge-14.12.jar'
            : 'https://github.com/xfl03/MCCustomSkinLoader/releases/download/14.12/CustomSkinLoader_Fabric-14.12.jar';
        const destination = type === 'forge'
            ? this.getPath('temp', 'CustomSkinLoader_Forge-14.12.jar')
            : this.getPath('temp', 'CustomSkinLoader_Fabric-14.12.jar');
        const handle = this.submit(Task.create('downloadCustomSkinLoader', async (context) => {
            const downloadStream = this.networkManager.request.stream(url, { followRedirect: true });
            await ensureFile(destination);
            const writeStream = createWriteStream(destination);
            let progress = 0;
            let total = 0;
            downloadStream.on('data', (chunk) => {
                progress += chunk.length;
                context.update(progress, total, url);
            });
            downloadStream.on('response', (r) => {
                total = Number.parseInt(r.headers['content-length'] as any, 10);
            });
            await new Promise((resolve, reject) => pipeline(downloadStream, writeStream, (e) => {
                if (e) reject(e);
                else resolve();
            }));
        }));
        await handle.wait();
        return this.resourceService.importResource({
            path: destination,
            type: 'mods',
        });
    }

    async doesAuthlibInjectionExisted(): Promise<boolean> {
        const jsonPath = this.getPath('authlib-injection.json');
        const content = await readJson(jsonPath).catch(() => undefined);
        if (!content) return false;
        const info = LibraryInfo.resolve(`${AUTHLIB_ORG_NAME}:${content.version}`);
        const mc = new MinecraftFolder(this.state.root);
        const libPath = mc.getLibraryByPath(info.path);
        return validateSha256(libPath, content.checksums.sha256);
    }

    async installAuthlibInjection(): Promise<string> {
        const jsonPath = this.getPath('authlib-injection.json');
        const mc = new MinecraftFolder(this.state.root);
        const root = this.state.root;

        const download = async (content: any) => {
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
            await this.submit(Task.create('installAuthlibInjector', Installer.installResolvedLibrariesTask(Version.resolveLibraries([authlib]), root).run)).wait();
            return mc.getLibraryByPath(info.path);
        };

        const content = await readJson(jsonPath).catch(() => undefined);
        let path: string;
        if (!content) {
            const body = await this.networkManager.request('https://authlib-injector.yushi.moe/artifact/latest.json').json();
            await writeFile(jsonPath, JSON.stringify(body));
            path = await download(body);
        } else {
            const info = LibraryInfo.resolve(`${AUTHLIB_ORG_NAME}:${content.version}`);
            const libPath = mc.getLibraryByPath(info.path);
            if (await validateSha256(libPath, content.checksums.sha256)) {
                path = libPath;
            } else {
                path = await download(content);
            }
        }

        let report: Partial<IssueReport> = {};
        this.diagnoseService.diagnoseUser(report);
        this.diagnoseService.report(report);

        return path;
    }
}
