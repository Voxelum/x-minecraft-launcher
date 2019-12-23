import { Task, Version } from '@xmcl/minecraft-launcher-core';
import { Unzip } from '@xmcl/unzip';
import { compressZipTo, fs, includeAllToZip, unpack7z } from 'main/utils';
import { tmpdir } from 'os';
import { basename, join, resolve } from 'path';
import { InstanceConfig } from 'universal/store/modules/instance';
import { v4 } from 'uuid';
import { ZipFile } from 'yazl';
import { Modpack } from './CurseForgeService';
import InstanceService from './InstanceService';

export async function exportInstance(this: InstanceService, { id, dest, type = 'full' }: { id?: string; dest: string; type: 'full' | 'no-assets' | 'curseforge' }) {
    if (this.getters.busy('instance')) return;
    this.commit('aquire', 'instance');
    id = id || this.state.instance.id;
    try {
        const root = this.state.root;
        const instanceObject = this.state.instance.all[id];
        const from = this.getPathUnder(id);
        const file = new ZipFile();
        const promise = compressZipTo(file, dest);

        if (type === 'curseforge') {
            throw new Error('Not implemented!');
        }

        await includeAllToZip(from, from, file);

        const defaultMcversion = this.state.instance.all[id].runtime.minecraft;
        const carriedVersionPaths = [];

        const versionInst = await Version.parse(root, defaultMcversion);
        carriedVersionPaths.push(...versionInst.pathChain);

        if (type === 'full') {
            const assetsJson = resolve(root, 'assets', 'indexes', `${versionInst.assets}.json`);
            file.addFile(assetsJson, `assets/indexes/${versionInst.assets}.json`);
            const objects = await fs.readFile(assetsJson, { encoding: 'utf-8' }).then(b => b.toString()).then(JSON.parse).then(manifest => manifest.objects);
            for (const hash of Object.keys(objects).map(k => objects[k].hash)) {
                file.addFile(resolve(root, 'assets', 'objects', hash.substring(0, 2), hash), `assets/objects/${hash.substring(0, 2)}/${hash}`);
            }
        }

        for (const verPath of carriedVersionPaths) {
            const versionId = basename(verPath);
            const versionFiles = await fs.readdir(verPath);
            for (const versionFile of versionFiles) {
                if (!await fs.stat(join(verPath, versionFile)).then(s => s.isDirectory())) {
                    file.addFile(join(verPath, versionFile), `versions/${versionId}/${versionFile}`);
                }
            }
        }

        for (const lib of versionInst.libraries) {
            file.addFile(resolve(root, 'libraries', lib.download.path),
                `libraries/${lib.download.path}`);
        }

        if (instanceObject.deployments.mods) {
            for (const r of instanceObject.deployments.mods.map(u => this.getters.getResource(u))
                .filter(r => r.type !== 'unknown')) {
                file.addFile(r.path, `mods/${r.name}${r.ext}`);
            }
        }
        if (instanceObject.deployments.resourcepacks) {
            for (const r of instanceObject.deployments.resourcepacks.map(u => this.getters.getResource(u))
                .filter(r => r.type !== 'unknown')) {
                file.addFile(r.path, `resourcepacks/${r.name}${r.ext}`);
            }
        }

        file.end();
        await promise;
    } finally {
        this.commit('release', 'instance');
    }
}
export async function importInstance(this: InstanceService, location: string) {
    const id = v4();
    const destFolderPath = this.getPathUnder(id);
    const isDirectory = fs.stat(location).then(s => s.isDirectory());

    let srcFolderPath = location;
    if (!isDirectory) {
        const tempDir = await fs.mkdtemp(join(tmpdir(), 'launcher'));
        await fs.createReadStream(location)
            .pipe(Unzip.createExtractStream(tempDir))
            .wait();
        srcFolderPath = tempDir;
    }

    await fs.ensureDir(destFolderPath);
    await fs.copy(srcFolderPath, destFolderPath, (path) => {
        if (path.endsWith('/versions')) return false;
        if (path.endsWith('/assets')) return false;
        if (path.endsWith('/libraries')) return false;
        if (path.endsWith('/resourcepacks')) return false;
        if (path.endsWith('/mods')) return false;
        return true;
    });

    await fs.copy(resolve(srcFolderPath, 'assets'), resolve(this.state.root, 'assets'));
    await fs.copy(resolve(srcFolderPath, 'libraries'), resolve(this.state.root, 'libraries'));
    await fs.copy(resolve(srcFolderPath, 'versions'), resolve(this.state.root, 'versions')); // TODO: check this

    const modsDir = resolve(srcFolderPath, 'mods');
    const mods = [];
    if (await fs.exists(modsDir)) {
        for (const file of await fs.readdir(modsDir)) {
            try {
                const resource = await this.resource.importUnknownResource({ path: resolve(srcFolderPath, 'mods', file) });
                if (resource) { mods.push(resource.hash); }
            } catch (e) {
                console.error(`Cannot import mod at ${file}.`);
            }
        }
    }

    const resourcepacksDir = resolve(srcFolderPath, 'resourcepacks');
    if (await fs.exists(resourcepacksDir)) {
        for (const file of await fs.readdir(resourcepacksDir)) {
            await this.resource.importUnknownResource({ path: resolve(srcFolderPath, 'resourcepacks', file), type: 'resourcepack' });
        }
    }

    let instanceTemplate: any = {}; // TODO: typecheck

    const proiflePath = resolve(srcFolderPath, 'instance.json');
    const isExportFromUs = await fs.stat(proiflePath).then(s => s.isFile()).catch(() => false);
    if (isExportFromUs) {
        instanceTemplate = await fs.readFile(proiflePath).then(buf => buf.toString()).then(JSON.parse, () => ({}));

        if (!instanceTemplate.deployments) {
            instanceTemplate.deployments = {
                mods,
            };
        }
    }

    await fs.writeFile(this.getPathUnder(id, 'instance.json'), JSON.stringify(instanceTemplate, null, 4));

    await this.loadInstance(id);

    if (!isDirectory) {
        await fs.remove(srcFolderPath);
    }
}

export async function importCurseforgeModpack(this: InstanceService, payload: { path: string; instanceId?: string }) {
    const { path, instanceId } = payload;
    const stat = await fs.stat(path);
    if (!stat.isFile()) throw new Error(`Cannot import curseforge modpack ${path}, since it's not a file!`);
    console.log(`Import curseforge modpack by path ${path}`);
    const installCurseforgeModpack = async (ctx: Task.Context) => {
        await fs.ensureDir(this.getPath('temp'));
        const dir = await fs.mkdtemp(this.getPath('temp', 'curseforge-'));
        const unpack = async () => unpack7z(path, dir);
        await ctx.execute(unpack);

        if (await fs.missing(join(dir, 'manifest.json'))) {
            throw new Error(`Cannot import curseforge modpack ${path}, since it doesn't have manifest.json`);
        }

        const deployments: InstanceConfig['deployments'] = {
            mods: [],
        };

        const resolveFile = async () => {
            const manifest: Modpack = await fs.readFile(join(dir, 'manifest.json')).then(b => JSON.parse(b.toString()));
            for (const f of manifest.files) {
                if (!f) continue;
                const uri = `curseforge://id/${f.projectID}/${f.fileID}`;
                deployments.mods.push(uri);
            }
            return manifest;
        };

        const manifest: Modpack = await this.submit(resolveFile).wait();
        // create profile accordingly 
        const createProfile = async () => {
            const forgeId = manifest.minecraft.modLoaders.find(l => l.id.startsWith('forge'));
            let id: string;
            if (instanceId) {
                id = instanceId;
                await this.editInstance({
                    id,
                    runtime: {
                        minecraft: manifest.minecraft.version,
                        forge: forgeId ? forgeId.id.substring(6) : '',
                        liteloader: '',
                    },
                    deployments,
                });
            } else {
                id = await this.createAndSelect({
                    name: manifest.name,
                    author: manifest.author,
                    runtime: {
                        minecraft: manifest.minecraft.version,
                        forge: forgeId ? forgeId.id.substring(6) : '',
                        liteloader: '',
                    },
                    deployments,
                });
            }
            const profileFolder = this.getPathUnder(id);
            // start handle override
            if (manifest.overrides) {
                await fs.copy(join(dir, manifest.overrides), profileFolder);
            }
        };
        await ctx.execute(createProfile);
        await fs.remove(dir);
    };
    await this.submit(installCurseforgeModpack).wait();
}
