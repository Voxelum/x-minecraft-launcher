import { getCurseforgeUrl } from '@main/entities/resource';
import { copyPassively, exists, isDirectory, isFile, readdirIfPresent } from '@main/util/fs';
import { ZipTask } from '@main/util/zip';
import { CurseforgeModpackManifest } from '@universal/entities/curseforge';
import { Exception } from '@universal/entities/exception';
import { createTemplate } from '@universal/entities/instance';
import { InstanceSchema, RuntimeVersions } from '@universal/entities/instance.schema';
import { UNKNOWN_RESOURCE } from '@universal/entities/resource';
import { isNonnull, requireObject, requireString } from '@universal/util/assert';
import { MinecraftFolder, Version } from '@xmcl/core';
import { createDefaultCurseforgeQuery, installCurseforgeModpackTask, readManifestTask, UnzipTask } from '@xmcl/installer';
import { task } from '@xmcl/task';
import { open, readAllEntries } from '@xmcl/unzip';
import { ensureDir, mkdtemp, readdir, readJson, remove, rename, stat } from 'fs-extra';
import { tmpdir } from 'os';
import { basename, dirname, join, relative, resolve } from 'path';
import InstanceResourceService from './InstanceResourceService';
import InstanceService, { EditInstanceOptions } from './InstanceService';
import ResourceService from './ResourceService';
import Service, { Inject, Singleton } from './Service';
import VersionService from './VersionService';

export interface InstanceFile { path: string; isDirectory: boolean; isResource: boolean }

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
     * Does this export include the libraries?
     * @default true
     */
    includeLibraries?: boolean;

    /**
     * Does this export includes assets?
     * @default true
     */
    includeAssets?: boolean;

    /**
     * Does this export includes the minecraft version jar? (like <minecraft>/versions/1.14.4.jar).
     * If this is false, then it will only export with version json.
     * @default true
     */
    includeVersionJar?: boolean;

    /**
     * If this is present, it will only exports the file paths in this array.
     * By default this is `undefined`, and it will export everything in the instance.
     */
    files?: string[];
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
     * The path of curseforge modpack zip file
     */
    path: string;
    /**
     * The destination instance path. If this is empty, it will create a new instance.
     */
    instancePath?: string;
}

export interface ImportModpackOptions {
    /**
     * The path of modpack directory
     */
    path: string;
    /**
     * The destination instance path. If this is empty, it will create a new instance.
     */
    instancePath?: string;
}

/**
 * Provide the abilities to import/export instance from/to modpack
 */
export default class InstanceIOService extends Service {
    @Inject('ResourceService')
    private resourceService!: ResourceService;

    @Inject('InstanceService')
    private instanceService!: InstanceService;

    @Inject('InstanceResourceService')
    private instanceResourceService!: InstanceResourceService;

    @Inject('VersionService')
    private versionService!: VersionService;

    /**
     * Export current instance as a modpack. Can be either curseforge or normal full Minecraft
     * @param options The export instance options
     */
    @Singleton('instance')
    async exportInstance(options: ExportInstanceOptions) {
        requireObject(options);

        const { src = this.state.instance.path, destinationPath: dest, includeAssets = true, includeLibraries = true, files, includeVersionJar = true } = options;

        if (!this.state.instance.all[src]) {
            this.warn(`Cannot export unmanaged instance ${src}`);
            return;
        }

        const version = this.getters.instanceVersion;

        if (version.id === '') {
            // TODO: throw
            this.warn(`Cannot export instance ${src} as its version is not installed!`);
            return;
        } 


        const root = this.state.root;
        const from = src;

        const zipTask = new ZipTask(dest).setName('profile.modpack.export');

        // add assets
        if (includeAssets) {
            const assetsJson = resolve(root, 'assets', 'indexes', `${version.assets}.json`);
            zipTask.addFile(assetsJson, `assets/indexes/${version.assets}.json`);
            const objects = await readJson(assetsJson).then(manifest => manifest.objects);
            for (const hash of Object.keys(objects).map(k => objects[k].hash)) {
                zipTask.addFile(resolve(root, 'assets', 'objects', hash.substring(0, 2), hash), `assets/objects/${hash.substring(0, 2)}/${hash}`);
            }
        }

        // add version json and jar
        const verionsChain = version.pathChain;
        for (const versionPath of verionsChain) {
            const versionId = basename(versionPath);
            if (includeVersionJar && await exists(join(versionPath, `${versionId}.jar`))) {
                zipTask.addFile(join(versionPath, `${versionId}.jar`), `versions/${versionId}/${versionId}.jar`);
            }
            zipTask.addFile(join(versionPath, `${versionId}.json`), `versions/${versionId}/${versionId}.json`);
        }

        // add libraries
        if (includeLibraries) {
            for (const lib of version.libraries) {
                zipTask.addFile(resolve(root, 'libraries', lib.download.path),
                    `libraries/${lib.download.path}`);
            }
        }

        // add misc files like config, log...
        if (files) {
            for (const file of files) {
                zipTask.addFile(join(src, file), file);
            }
        } else {
            await zipTask.includeAs(from, '');
        }

        await this.submit(zipTask);
    }

    /**
     * Scan all the files under the current instance.
     * It will hint if a mod resource is in curseforge
     */
    async getInstanceFiles(): Promise<InstanceFile[]> {
        const path = this.state.instance.path;
        const files = [] as InstanceFile[];

        const scan = async (p: string) => {
            const status = await stat(p);
            const ino = status.ino;
            const isDirectory = status.isDirectory();
            const isResource = !!this.resourceService.getResourceByKey(ino)?.curseforge;
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

        const ganeVersionInstance = this.state.version.local.find(v => v.id === gameVersion);
        const instance = this.state.instance.all[instancePath];
        const modLoaders = ganeVersionInstance?.forge ? [{
            id: `forge-${ganeVersionInstance?.forge}`,
            primary: true,
        }] : [];
        const curseforgeConfig: CurseforgeModpackManifest = {
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

        const zipTask = new ZipTask(destinationPath);

        zipTask.addEmptyDirectory('overrides');

        for (let file of overrides) {
            if (file.startsWith('mods/')) {
                const mod = this.state.instance.mods.find((i) => (i.location.replace('\\', '/') + i.ext) === file);
                if (mod && mod.curseforge) {
                    curseforgeConfig.files.push({ projectID: mod.curseforge.projectId, fileID: mod.curseforge.fileId, required: true });
                } else {
                    zipTask.addFile(join(instancePath, file), `overrides/${file}`);
                }
            } else if (file.startsWith('resourcepacks/')) {
                const resourcepack = this.state.instance.resourcepacks.find((i) => (i.location.replace('\\', '/') + i.ext) === file);
                if (resourcepack && resourcepack.curseforge) {
                    curseforgeConfig.files.push({ projectID: resourcepack.curseforge.projectId, fileID: resourcepack.curseforge.fileId, required: true });
                } else {
                    zipTask.addFile(join(instancePath, file), `overrides/${file}`);
                }
            } else {
                zipTask.addFile(join(instancePath, file), `overrides/${file}`);
            }
        }

        this.log(`Export instance ${instancePath} to curseforge ${JSON.stringify(curseforgeConfig, null, 4)}`);

        zipTask.addBuffer(Buffer.from(JSON.stringify(curseforgeConfig)), 'manifest.json');

        await this.submit(zipTask);
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
        await copyPassively(resolve(path, 'assets'), this.getPath('assets'));
        await copyPassively(resolve(path, 'libraries'), this.getPath('libraries'));
        await copyPassively(resolve(path, 'versions'), this.getPath('versions'));

        return true;
    }

    /**
     * Import an instance from a game zip file or a game directory. The location root must be the game directory.
     * @param location The zip or directory path
     */
    async importInstance(location: string) {
        requireString(location);

        const isDir = await isDirectory(location);

        let srcDirectory = location;
        if (!isDir) {
            srcDirectory = await mkdtemp(join(tmpdir(), 'launcher'));
            const zipFile = await open(location);
            const entries = await readAllEntries(zipFile);
            const unzipTask = new UnzipTask(zipFile, entries, srcDirectory);
            await unzipTask.startAndWait();
        }

        // check if this game contains the instance.json from us
        let instanceTemplate: InstanceSchema;

        let instanceConfigPath = resolve(srcDirectory, 'instance.json');
        let isExportFromUs = await isFile(instanceConfigPath);
        if (isExportFromUs) {
            instanceTemplate = await this.getPersistence({ path: instanceConfigPath, schema: InstanceSchema });
        } else {
            instanceTemplate = createTemplate();
            instanceTemplate.creationDate = Date.now();

            const dir = new MinecraftFolder(srcDirectory);
            const versions = await readdir(dir.versions);
            const localVersion: RuntimeVersions = {} as any;
            for (const ver of versions) {
                Object.assign(localVersion, await this.versionService.resolveLocalVersion(ver, dir.root));
            }
            delete localVersion.id;
            delete localVersion.folder;
            instanceTemplate.runtime = localVersion;
            instanceTemplate.name = basename(location);
        }

        // create instance
        const instancePath = await this.instanceService.createInstance(instanceTemplate);

        // start copy from src to instance
        await copyPassively(srcDirectory, instancePath, (path) => {
            if (path.endsWith('/versions')) return false;
            if (path.endsWith('/assets')) return false;
            if (path.endsWith('/libraries')) return false;
            return true;
        });

        // copy assets, library and versions
        await copyPassively(resolve(srcDirectory, 'assets'), this.getPath('assets'));
        await copyPassively(resolve(srcDirectory, 'libraries'), this.getPath('libraries'));
        await copyPassively(resolve(srcDirectory, 'versions'), this.getPath('versions'));

        if (!isDir) { await remove(srcDirectory); }
    }

    /**
     * Import the curseforge modpack zip file to the instance.
     * @param options The options provide instance directory path and curseforge modpack zip path
     */
    async importCurseforgeModpack(options: ImportCurseforgeModpackOptions) {
        let { path, instancePath } = options;

        if (!await isFile(path)) {
            throw new Exception({ type: 'requireCurseforgeModpackAFile', path }, `Cannot import curseforge modpack ${path}, since it's not a file!`);
        }

        this.log(`Import curseforge modpack by path ${path}`);
        const { instanceResourceService, log, resourceService, instanceService } = this;
        const installCurseforgeModpack = task('installCurseforgeModpack', async function () {
            let manifest = await this.yield(readManifestTask(path)).catch(() => {
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
                await instanceService.editInstance({
                    instancePath,
                    ...config,
                });
            } else {
                instancePath = await instanceService.createInstance({
                    name: manifest.name,
                    author: manifest.author,
                    ...config,
                });
            }

            // deploy existed resources
            const filesToDeploy = manifest.files
                .map((f) => resourceService.getResourceByKey(getCurseforgeUrl(f.projectID, f.fileID)))
                .filter(isNonnull);
            await ensureDir(join(instancePath, 'mods'));
            await ensureDir(join(instancePath, 'resourcepacks'));
            log(`Deploy ${filesToDeploy.length} existed resources from curseforge modpack!`);
            await instanceResourceService.deploy({ resources: filesToDeploy, path: instancePath });

            // filter out existed resources
            manifest.files = manifest.files.filter((f) => !resourceService.getResourceByKey(getCurseforgeUrl(f.projectID, f.fileID)));

            let files: Array<{ path: string; projectID: number; fileID: number; url: string }> = [];
            let defaultQuery = createDefaultCurseforgeQuery();

            log(`Install ${manifest.files.length} files from curseforge modpack!`);

            await this.concat(installCurseforgeModpackTask(path, instancePath, {
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
            }));

            if (manifest.files.length > 0) {
                const resources = await resourceService.importResources({
                    files: files.map((f) => ({
                        path: f.path,
                        url: [f.url, getCurseforgeUrl(f.projectID, f.fileID)],
                        source: {
                            curseforge: { projectId: f.projectID, fileId: f.fileID },
                        },
                    })),
                });
                const mapping: Record<string, string> = {};
                for (const file of files) {
                    mapping[`${file.projectID}:${file.fileID}`] = file.path;
                }
                // rename the resource to correct name
                for (const res of resources.filter(r => r !== UNKNOWN_RESOURCE)) {
                    const path = mapping[`${res.curseforge!.projectId}:${res.curseforge!.fileId}`];
                    const realName = basename(res.location) + res.ext;
                    const realPath = dirname(path) + realName;
                    await rename(path, realPath);
                }
            }

            return instancePath;
        });
        return this.submit(installCurseforgeModpack);
    }
}
