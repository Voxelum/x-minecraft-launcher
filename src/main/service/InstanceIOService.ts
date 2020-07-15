import { copyPassively, isDirectory, isFile, readdirIfPresent } from '@main/util/fs';
import { getCurseforgeUrl } from '@main/util/resource';
import { openCompressedStreamTask } from '@main/util/zip';
import { createTemplate, InstanceConfig } from '@universal/store/modules/instance';
import { InstanceSchema } from '@universal/store/modules/instance.schema';
import { isNonnull, requireObject, requireString } from '@universal/util/assert';
import { Exception } from '@universal/util/exception';
import { Version } from '@xmcl/core';
import { CurseforgeInstaller } from '@xmcl/installer';
import { Task } from '@xmcl/task';
import Unzip from '@xmcl/unzip';
import { createReadStream, mkdtemp, readdir, readJson, remove, stat } from 'fs-extra';
import { tmpdir } from 'os';
import { basename, join, resolve, relative } from 'path';
import InstanceResourceService from './InstanceResourceService';
import InstanceService, { EditInstanceOptions } from './InstanceService';
import ResourceService from './ResourceService';
import Service, { Inject, Singleton } from './Service';
import { Modpack } from './CurseForgeService';

export interface ExportInstanceOptions {
    /**
     * The src path of the instance
     */
    src?: string;
    /**
     * The dest path of the exported instance
     */
    destinationPath: string;
    /**
     * The export mod of this operation
     */
    mode: 'full' | 'no-assets';
}

export interface ExportCurseforgeModpackOptions {
    /**
     * An list of files should be included in overrides
     */
    overrides: string[];
    /**
     * The instance path to be exported
     */
    instancePath?: string;
    /**
    * The dest path of the exported instance
    */
    destinationPath: string;

    name: string;

    version: string;

    author: string;

    gameVersion: string;
}

export interface ImportCurseforgeModpackOptions {
    /**
     * The path of modpack
     */
    path: string;
    /**
     * The destination instance path. If this is empty, it will create a new instance.
     */
    instancePath?: string;
}

export default class InstanceIOService extends Service {
    @Inject('ResourceService')
    private resourceService!: ResourceService;

    @Inject('InstanceService')
    private instanceService!: InstanceService;

    @Inject('InstanceResourceService')
    private instanceResourceService!: InstanceResourceService;

    /**
     * Export current instance as a modpack. Can be either curseforge or normal full Minecraft
     * @param options The export instance options
     */
    @Singleton('instance')
    async exportInstance(options: ExportInstanceOptions) {
        requireObject(options);

        let { src = this.state.instance.path, destinationPath: dest, mode = 'full' } = options;

        if (this.state.instance.all[src]) {
            this.warn(`Cannot export unmanaged instance ${src}`);
            return;
        }

        let root = this.state.root;
        // let instanceObject = this.state.instance.all[src];

        let from = src;

        let { task, include, add, end } = openCompressedStreamTask(from);
        let handle = this.submit(task);
        await include(from, from);

        let defaultMcversion = this.state.instance.all[src].runtime.minecraft;

        let parsedVersion = await Version.parse(root, defaultMcversion);
        let verionsChain = parsedVersion.pathChain;

        if (mode === 'full') {
            let assetsJson = resolve(root, 'assets', 'indexes', `${parsedVersion.assets}.json`);
            add(assetsJson, `assets/indexes/${parsedVersion.assets}.json`);
            let objects = await readJson(assetsJson).then(manifest => manifest.objects);
            for (let hash of Object.keys(objects).map(k => objects[k].hash)) {
                add(resolve(root, 'assets', 'objects', hash.substring(0, 2), hash), `assets/objects/${hash.substring(0, 2)}/${hash}`);
            }
        }

        for (let versionPath of verionsChain) {
            let versionId = basename(versionPath);
            let versionFiles = await readdir(versionPath);
            for (let versionFile of versionFiles) {
                add(join(versionPath, versionFile), `versions/${versionId}/${versionFile}`);
            }
        }

        for (let lib of parsedVersion.libraries) {
            add(resolve(root, 'libraries', lib.download.path),
                `libraries/${lib.download.path}`);
        }

        end();

        await handle.wait();
    }

    /**
     * Scan all the files under the current instance.
     * It will hint if a mod resource is in curseforge
     */
    async getInstanceFiles(): Promise<{ path: string; isDirectory: boolean; isResource: boolean }[]> {
        const path = this.state.instance.path;
        const files = [] as { path: string; isDirectory: boolean; isResource: boolean }[];

        const scan = async (p: string) => {
            const status = await stat(p);
            const ino = status.ino;
            const isDirectory = status.isDirectory();
            const isResource = !!this.resourceService.getResourceByKey(ino)?.source.curseforge;
            files.push({ isDirectory, path: relative(path, p).replace(/\\/g, '/'), isResource });
            if (isDirectory) {
                let childs = await readdirIfPresent(p);
                for (let child of childs) {
                    await scan(join(p, child));
                }
            }
        };

        await scan(path);
        files.shift();

        return files;
    }

    /**
     * Export the instance as an curseforge modpack
     * @param options The curseforge modpack export options
     */
    async exportCurseforge(options: ExportCurseforgeModpackOptions) {
        requireObject(options);

        let { instancePath = this.state.instance.path, destinationPath, overrides, name, version, gameVersion, author } = options;

        if (!this.state.instance.all[instancePath]) {
            this.warn(`Cannot export unmanaged instance ${instancePath}`);
            return;
        }

        const ganeVersionInstance = this.state.version.local.find(v => v.folder === gameVersion);
        const instance = this.state.instance.all[instancePath];
        const modLoaders = ganeVersionInstance?.forge ? [{
            id: `forge-${ganeVersionInstance?.forge}`,
            primary: true,
        }] : [];
        const curseforgeConfig: Modpack = {
            manifestType: 'minecraftModpack',
            manifestVersion: 1,
            minecraft: {
                version: ganeVersionInstance?.minecraft ?? instance.runtime.minecraft,
                modLoaders,
            },
            name: options.name ?? name,
            version,
            author: author ?? instance.author,
            files: [],
            overrides: 'overrides',
        };

        for (const mod of this.state.instance.mods) {
            if (!mod.source.curseforge) {
                // add to override
            } else {
                curseforgeConfig.files.push({ projectID: mod.source.curseforge.projectId, fileID: mod.source.curseforge.fileId, required: true });
            }
        }

        const { task, add, addBuffer, addEmptyDirectory, end } = openCompressedStreamTask(destinationPath);

        addEmptyDirectory('overrides');

        for (let file of overrides) {
            await add(join(instancePath, file), `overrides/${file}`);
        }

        addBuffer(Buffer.from(JSON.stringify(curseforgeConfig)), 'manifest.json');

        end();

        const handle = this.submit(task);
        await handle.wait();
    }

    /**
     * Link a existed instance on you disk.
     * @param path 
     */
    async linkInstance(path: string) {
        if (this.state.instance.all[path]) {
            this.log(`Skip to link already managed instance ${path}`);
            return false;
        }
        let loaded = await this.instanceService.loadInstance(path);
        if (!loaded) {
            await this.instanceService.createInstance({ path });
        }

        // copy assets, library and versions
        await copyPassively(resolve(path, 'assets'), this.getGameAssetsPath('assets'));
        await copyPassively(resolve(path, 'libraries'), this.getGameAssetsPath('libraries'));
        await copyPassively(resolve(path, 'versions'), this.getGameAssetsPath('versions'));

        return true;
    }

    /**
     * Import an instance from a game zip file. The zip file root must be the game directory, or it must contains the `.minecraft` directory.
     * @param location The zip or directory path
     */
    async importInstance(location: string) {
        requireString(location);

        let isDir = await isDirectory(location);
        let srcDirectory = location;

        if (!isDir) {
            srcDirectory = await mkdtemp(join(tmpdir(), 'launcher'));
            await createReadStream(location)
                .pipe(Unzip.createExtractStream(srcDirectory))
                .wait();
        }

        // check if this game contains the instance.json from us
        let instanceTemplate: InstanceConfig;

        let instanceConfigPath = resolve(srcDirectory, 'instance.json');
        let isExportFromUs = await isFile(instanceConfigPath);
        if (isExportFromUs) {
            instanceTemplate = await this.getPersistence({ path: instanceConfigPath, schema: InstanceSchema });
        } else {
            instanceTemplate = createTemplate();
            instanceTemplate.creationDate = Date.now();
        }

        // create instance
        let instancePath = await this.instanceService.createInstance(instanceTemplate);

        // start copy from src to instance
        await copyPassively(srcDirectory, instancePath, (path) => {
            if (path.endsWith('/versions')) return false;
            if (path.endsWith('/assets')) return false;
            if (path.endsWith('/libraries')) return false;
            return true;
        });

        // copy assets, library and versions
        await copyPassively(resolve(srcDirectory, 'assets'), this.getGameAssetsPath('assets'));
        await copyPassively(resolve(srcDirectory, 'libraries'), this.getGameAssetsPath('libraries'));
        await copyPassively(resolve(srcDirectory, 'versions'), this.getGameAssetsPath('versions')); // TODO: check this

        if (!isDir) { await remove(srcDirectory); }
    }

    async importCurseforgeModpack(options: ImportCurseforgeModpackOptions) {
        let { path, instancePath } = options;

        if (!await isFile(path)) {
            throw new Exception({ type: 'requireCurseforgeModpackAFile', path }, `Cannot import curseforge modpack ${path}, since it's not a file!`);
        }

        this.log(`Import curseforge modpack by path ${path}`);
        const installCurseforgeModpack = Task.create('installCurseforgeModpack', async (ctx: Task.Context) => {
            let manifest = await ctx.execute(CurseforgeInstaller.readManifestTask(path)).catch(() => {
                throw new Exception({ type: 'invalidCurseforgeModpack', path });
            });

            let forgeId = manifest.minecraft.modLoaders.find(l => l.id.startsWith('forge'));

            let config: EditInstanceOptions = {
                runtime: {
                    minecraft: manifest.minecraft.version,
                    forge: forgeId ? forgeId.id.substring(6) : '',
                    liteloader: '',
                    fabricLoader: '',
                    yarn: '',
                },
            };

            if (instancePath) {
                await this.instanceService.editInstance({
                    instancePath,
                    ...config,
                });
            } else {
                instancePath = await this.instanceService.createInstance({
                    name: manifest.name,
                    author: manifest.author,
                    ...config,
                });
            }

            // filter out existed resources
            manifest.files = manifest.files.filter((f) => {
                let resource = this.resourceService.getResourceByKey(getCurseforgeUrl(f.projectID, f.fileID));
                return !resource;
            });

            // deploy existed resources
            let filesToDeploy = manifest.files.map((f) => this.resourceService.getResourceByKey(getCurseforgeUrl(f.projectID, f.fileID)))
                .filter(isNonnull);
            await this.instanceResourceService.deploy(filesToDeploy);

            let files: Array<{ path: string; projectID: number; fileID: number; url: string }> = [];
            let defaultQuery = CurseforgeInstaller.createDefaultCurseforgeQuery();
            await CurseforgeInstaller.installCurseforgeModpackTask(path, instancePath, {
                manifest,
                async queryFileUrl(projectId: number, fileId: number) {
                    let result = await defaultQuery(projectId, fileId);
                    files.push({ path: '', projectID: projectId, fileID: fileId, url: result });
                    return result;
                },
                filePathResolver(p, f, m, u) {
                    let path = m.getMod(basename(u));
                    files.find(fi => fi.fileID === f)!.path = path;
                    return path;
                },
            }).run(ctx);

            await this.resourceService.importResources(files.map((f) => ({
                filePath: f.path,
                url: [f.url, getCurseforgeUrl(f.projectID, f.fileID)],
                source: {
                    curseforge: { projectId: f.projectID, fileId: f.fileID },
                },
            })));
            return instancePath;
        });
        return this.submit(installCurseforgeModpack).wait();
    }
}
