import { readHeader } from '@main/entities/resource';
import { pipeline, sha1ByPath } from '@main/util/fs';
import { openCompressedStreamTask } from '@main/util/zip';
import { Modpack } from '@universal/entities/modpack';
import { Resource, Resources, UNKNOWN_RESOURCE } from '@universal/entities/resource';
import { ResourceDomain, ResourceType } from '@universal/entities/resource.schema';
import { extract } from '@xmcl/unzip';
import { createHash } from 'crypto';
import { FileType, stream as fileTypeByStream } from 'file-type';
import { createReadStream, remove, stat, unlink } from 'fs-extra';
import { basename, extname } from 'path';
import InstanceIOService from './InstanceIOService';
import ResourceService from './ResourceService';
import Service, { Inject } from './Service';

export type ExpectFileType = string | '*' | 'mods' | 'forge' | 'fabric' | 'resourcepack' | 'liteloader' | 'curseforge-modpack' | 'save';

export interface ReadFileMetadataOptions {
    path: string;
    hint?: ExpectFileType;
    size?: number;
}

export interface ImportFileOptions {
    path: string;
    hint?: ExpectFileType;
    size?: number;
}

export interface FileMetadata {
    /**
     * Where the file import from
     */
    path: string;
    domain: ResourceDomain;
    type: ResourceType;
    fileType: FileType | 'unknown' | 'directory';
    existed: boolean;
    /**
     * Suggested display name
     */
    displayName: string;
    /**
     * Metadata of the file
     */
    metadata: any;
    uri: string;
}

export interface FileCommitImportOptions {
    files: FileMetadata[];
}

export default class IOService extends Service {
    @Inject('ResourceService')
    private resourceService!: ResourceService;

    @Inject('InstanceIOService')
    private instanceIOService!: InstanceIOService;

    /**
     * Import the file to the launcher
     * @param options 
     */
    async importFile(options: ImportFileOptions): Promise<Resource> {
        const { fileType, domain, type, uri, displayName, metadata, path, existed } = await this.readFileMetadata(options);
        if (existed) {
            return this.getters.queryResource(uri);
        }
        let result: Resource = UNKNOWN_RESOURCE;
        if (fileType === 'directory') {
            if (domain === ResourceDomain.ResourcePacks || domain === ResourceDomain.Saves || type === ResourceType.CurseforgeModpack) {
                const tempZipPath = `${this.getTempPath(displayName)}.zip`;
                const { include, task, end } = openCompressedStreamTask(tempZipPath);

                await include('', path);
                end();
                await task.execute().wait();
                // zip and import
                result = await this.resourceService.importResource({ path: tempZipPath, type });
                await unlink(tempZipPath);
            } if (domain === ResourceDomain.Modpacks && type === ResourceType.Modpack) {
                const root = (metadata as Modpack).root;
                await this.instanceIOService.importInstance(root);
            } else {
                throw new Error(); // TODO: throw correct error
            }
        } else if (domain === ResourceDomain.Modpacks && type === ResourceType.Modpack) {
            const tempDir = this.getTempPath(displayName);
            await extract(path, tempDir);
            await this.instanceIOService.importInstance(tempDir);
            await remove(tempDir);
        } else if (fileType === 'zip' || extname(path) === '.jar') {
            result = await this.resourceService.importResource({ path, type });
        }
        return result;
    }

    /**
     * Read an external file metadata. This can be used before the file drop into the launcher.
     */
    async readFileMetadata(options: ReadFileMetadataOptions): Promise<FileMetadata> {
        const { path, hint } = options;
        const fileStat = await stat(path);
        const result: FileMetadata = {
            path,
            type: ResourceType.Unknown,
            domain: ResourceDomain.Unknown,
            fileType: 'unknown',
            displayName: basename(path),
            metadata: {},
            uri: '',
            existed: false,
        };

        if (fileStat.isDirectory()) {
            const { type: resourceType, suggestedName, uri, metadata, icon } = await readHeader(path, '', hint);
            result.displayName = suggestedName;
            result.existed = !!this.resourceService.getResourceByKey(uri);
            result.type = resourceType as any;
            result.metadata = metadata;
            result.uri = uri;
        } else {
            let resource: Resource | undefined = this.resourceService.getResourceByKey(fileStat.ino);
            let hash: string | undefined;
            let fileType: FileType | 'unknown' = 'unknown';

            const ext = extname(path);
            if (!resource) {
                const readStream = await fileTypeByStream(createReadStream(path));
                const hashStream = createHash('sha1').setEncoding('hex');
                await pipeline(readStream, hashStream);
                fileType = readStream.fileType?.ext ?? 'unknown';
                hash = hashStream.digest('hex');
                resource = this.resourceService.getResourceByKey(hash);
            }
            if (!hash) {
                hash = resource?.hash ?? await sha1ByPath(path);
            }
            result.fileType = fileType;
            if (resource) {
                // resource existed
                result.displayName = resource.name;
                result.existed = true;
                result.type = resource.type;
                result.domain = resource.domain;
                result.metadata = resource.metadata;
                result.uri = resource.uri[0];
            } else if (fileType === 'zip' || ext === '.jar' || ext === '.litemod') {
                const { type: resourceType, suggestedName, uri, metadata, icon, domain } = await readHeader(path, hash, hint);
                result.displayName = suggestedName;
                result.existed = !!this.resourceService.getResourceByKey(uri);
                result.type = resourceType;
                result.domain = domain;
                result.metadata = metadata;
                result.uri = uri;
            }
        }
        return result;
    }

    async readFilesMetadata(options: ReadFileMetadataOptions[]): Promise<FileMetadata[]> {
        return Promise.all(options.map((file) => this.readFileMetadata(file)));
    }
}
