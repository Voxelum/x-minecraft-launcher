import { Version } from '@xmcl/minecraft-launcher-core';
import { Unzip } from '@xmcl/unzip';
import { compressZipTo, fs, includeAllToZip } from 'main/utils';
import { tmpdir } from 'os';
import { basename, join, resolve } from 'path';
import { v4 } from 'uuid';
import { ZipFile } from 'yazl';
import InstanceService from './InstanceService';

export async function exportInstance(this: InstanceService, { id, dest, type = 'full' }: { id?: string; dest: string; type: 'full' | 'no-assets' | 'curseforge' }) {
    if (this.getters.busy('instance')) return;
    this.commit('aquire', 'instance');
    id = id || this.state.instance.id;
    try {
        const root = this.state.root;
        const from = join(root, 'profiles', id);
        const file = new ZipFile();
        const promise = compressZipTo(file, dest);

        if (type === 'curseforge') {
            throw new Error('Not implemented!');
        }

        await includeAllToZip(from, from, file);

        const { resourcepacks, mods } = this.getters.deployingResources;
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

        for (const resourcepack of resourcepacks) {
            file.addFile(resourcepack.path, `resourcepacks/${resourcepack.name}${resourcepack.ext}`);
        }

        for (const mod of mods) {
            file.addFile(mod.path, `mods/${basename(mod.path)}`);
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
                const resource = await this.resource.importResource({ path: resolve(srcFolderPath, 'mods', file) });
                if (resource) { mods.push(resource.hash); }
            } catch (e) {
                console.error(`Cannot import mod at ${file}.`);
            }
        }
    }

    const resourcepacksDir = resolve(srcFolderPath, 'resourcepacks');
    if (await fs.exists(resourcepacksDir)) {
        for (const file of await fs.readdir(resourcepacksDir)) {
            await this.resource.importResource({ path: resolve(srcFolderPath, 'resourcepacks', file), type: 'resourcepack' });
        }
    }

    let profileTemplate: any = {}; // TODO: typecheck

    const proiflePath = resolve(srcFolderPath, 'profile.json');
    const isExportFromUs = await fs.stat(proiflePath).then(s => s.isFile()).catch(_ => false);
    if (isExportFromUs) {
        profileTemplate = await fs.readFile(proiflePath).then(buf => buf.toString()).then(JSON.parse, () => ({}));
        Reflect.deleteProperty(profileTemplate, 'java');

        if (!profileTemplate.deployments) {
            profileTemplate.deployments = {
                mods,
            };
        }
    }

    await fs.writeFile(this.getPathUnder(id, 'profile.json'), JSON.stringify(profileTemplate, null, 4));

    await this.loadProfile(id);

    if (!isDirectory) {
        await fs.remove(srcFolderPath);
    }
}
