import { copyPassively, isDirectory, isFile, readdirIfPresent } from '@main/util/fs';
import { compressZipTo, includeAllToZip } from '@main/util/zip';
import { createTemplate, InstanceConfig } from '@universal/store/modules/instance';
import { InstanceSchema } from '@universal/store/modules/instance.schema';
import { requireObject, requireString } from '@universal/util/assert';
import { Exception } from '@universal/util/exception';
import { Version } from '@xmcl/core';
import { CurseforgeInstaller } from '@xmcl/installer';
import { Task } from '@xmcl/task';
import Unzip from '@xmcl/unzip';
import { createReadStream, mkdtemp, readdir, readJson, remove } from 'fs-extra';
import { tmpdir } from 'os';
import { basename, join, resolve } from 'path';
import { ZipFile } from 'yazl';
import InstanceService from './InstanceService';
import ResourceService from './ResourceService';
import Service, { Inject, Singleton } from './Service';

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
    mode: 'full' | 'no-assets' | 'curseforge';
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

export class InstanceIOService extends Service {
    @Inject('ResourceService')
    private resourceService!: ResourceService;

    @Inject('InstanceService')
    private instanceService!: InstanceService;

    /**
     * Export current instance as a modpack. Can be either curseforge or normal full Minecraft
     * @param options The export instance options
     */
    @Singleton('instance')
    async exportInstance(options: ExportInstanceOptions) {
        requireObject(options);

        let { src = this.state.instance.path, destinationPath: dest, mode = 'full' } = options;
        // this.precondition('missingVersionJar');
        // this.precondition('missingVersionJson');
        // this.precondition('missingLibraries');

        if (this.state.instance.all[src]) {
            return;
        }

        let root = this.state.root;
        let instanceObject = this.state.instance.all[src];

        let from = src;
        let zipFile = new ZipFile();
        let promise = compressZipTo(zipFile, dest);

        if (mode === 'curseforge') {
            throw new Error('Not implemented!');
        }

        await includeAllToZip(from, from, zipFile);

        let defaultMcversion = this.state.instance.all[src].runtime.minecraft;

        let parsedVersion = await Version.parse(root, defaultMcversion);
        let verionsChain = parsedVersion.pathChain;

        if (mode === 'full') {
            // this.precondition('missingAssetsIndex');
            // this.precondition('missingAssets');
            let assetsJson = resolve(root, 'assets', 'indexes', `${parsedVersion.assets}.json`);
            zipFile.addFile(assetsJson, `assets/indexes/${parsedVersion.assets}.json`);
            let objects = await readJson(assetsJson).then(manifest => manifest.objects);
            for (let hash of Object.keys(objects).map(k => objects[k].hash)) {
                zipFile.addFile(resolve(root, 'assets', 'objects', hash.substring(0, 2), hash), `assets/objects/${hash.substring(0, 2)}/${hash}`);
            }
        }

        for (let versionPath of verionsChain) {
            let versionId = basename(versionPath);
            let versionFiles = await readdir(versionPath);
            for (let versionFile of versionFiles) {
                if (!await isDirectory(join(versionPath, versionFile))) {
                    zipFile.addFile(join(versionPath, versionFile), `versions/${versionId}/${versionFile}`);
                }
            }
        }

        for (let lib of parsedVersion.libraries) {
            zipFile.addFile(resolve(root, 'libraries', lib.download.path),
                `libraries/${lib.download.path}`);
        }

        if (instanceObject.deployments.mods) {
            for (let mod of instanceObject.deployments.mods.map(u => this.getters.getResource(u))
                .filter(r => r.type !== 'unknown')) {
                zipFile.addFile(mod.path, `mods/${mod.name}${mod.ext}`);
            }
        }
        if (instanceObject.deployments.resourcepacks) {
            for (let res of instanceObject.deployments.resourcepacks.map(u => this.getters.getResource(u))
                .filter(r => r.type !== 'unknown')) {
                zipFile.addFile(res.path, `resourcepacks/${res.name}${res.ext}`);
            }
        }

        zipFile.end();
        await promise;
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

        let deployments = instanceTemplate.deployments;
        if (!deployments.mods) deployments.mods = [];
        if (!deployments.resourcepacks) deployments.resourcepacks = [];

        // create instance
        let instancePath = await this.instanceService.createInstance(instanceTemplate);

        // start copy from src to instance
        await copyPassively(srcDirectory, instancePath, (path) => {
            if (path.endsWith('/versions')) return false;
            if (path.endsWith('/assets')) return false;
            if (path.endsWith('/libraries')) return false;
            if (path.endsWith('/resourcepacks')) return false;
            if (path.endsWith('/mods')) return false;
            return true;
        });

        // copy assets, library and versions
        await copyPassively(resolve(srcDirectory, 'assets'), this.getGameAssetsPath('assets'));
        await copyPassively(resolve(srcDirectory, 'libraries'), this.getGameAssetsPath('libraries'));
        await copyPassively(resolve(srcDirectory, 'versions'), this.getGameAssetsPath('versions')); // TODO: check this

        // import mods/resourcepacks
        let mods = [];
        let modsDir = resolve(srcDirectory, 'mods');
        for (let file of await readdirIfPresent(modsDir)) {
            try {
                let resource = await this.resourceService.importUnknownResource({ path: resolve(srcDirectory, 'mods', file), type: 'mods' });
                if (resource.type !== 'unknown') { mods.push(resource.hash); }
            } catch (e) {
                this.pushException({ type: 'instanceImportIllegalResource', file });
            }
        }

        let resourcepacks = [];
        let resourcepacksDir = resolve(srcDirectory, 'resourcepacks');
        for (let file of await readdirIfPresent(resourcepacksDir)) {
            try {
                let resource = await this.resourceService.importUnknownResource({ path: resolve(srcDirectory, 'resourcepacks', file), type: 'resourcepack' });
                if (resource.type !== 'unknown') { resourcepacks.push(resource.hash); }
            } catch (e) {
                this.pushException({ type: 'instanceImportIllegalResource', file });
            }
        }

        if (!isDir) { await remove(srcDirectory); }
    }

    async importCurseforgeModpack(options: ImportCurseforgeModpackOptions) {
        let { path, instancePath } = options;

        if (await isFile(path)) {
            throw new Exception({ type: 'requireCurseforgeModpackAFile', path }, `Cannot import curseforge modpack ${path}, since it's not a file!`);
        }

        this.log(`Import curseforge modpack by path ${path}`);
        const installCurseforgeModpack = Task.create('installCurseforgeModpack', async (ctx: Task.Context) => {
            let manifest = await ctx.execute(CurseforgeInstaller.readManifestTask(path)).catch(() => {
                throw new Exception({ type: 'invalidCurseforgeModpack', path });
            });

            let forgeId = manifest.minecraft.modLoaders.find(l => l.id.startsWith('forge'));

            let config: Partial<InstanceConfig> = {
                deployments: {
                    mods: manifest.files.map(f => `curseforge://id/${f.projectID}/${f.fileID}`),
                },
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

            await ctx.execute(CurseforgeInstaller.installCurseforgeModpackTask(path, instancePath, { manifest }));
        });
        await this.submit(installCurseforgeModpack).wait();
    }
}
