import { readResourceHeader } from '@main/entities/resource';
import { pipeline, sha1, sha1ByPath } from '@main/util/fs';
import { openCompressedStreamTask } from '@main/util/zip';
import { Resource } from '@universal/entities/resource';
import { createHash } from 'crypto';
import { FileType, stream as fileTypeByStream } from 'file-type';
import { createReadStream, rename, stat, unlink, writeFile } from 'fs-extra';
import { basename, extname } from 'path';
import ResourceService from './ResourceService';
import Service, { Inject } from './Service';

export type ExpectFileType = string | '*' | 'mods' | 'forge' | 'fabric' | 'resourcepack' | 'liteloader' | 'curseforge-modpack' | 'save';

export interface ReadFileMetadataOptions {
    path: string;
    hint?: ExpectFileType;
    size?: number;
}
export interface FileMetadata {
    /**
     * Where the file import from
     */
    path: string;
    type: BuiltinType | 'modpack' | 'unknown';
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

    async importFile(options: FileMetadata): Promise<void> {
        const { path, metadata, uri, displayName, type } = options;

        const fileStat = await stat(path);
        const hash = sha1ByPath(path);

        if (fileStat.isDirectory()) {
            const { type: resourceType, suggestedName, uri, domain } = await readResourceHeader(path, type);
            if (!this.resourceService.getResourceByKey(uri)) {
                // resource not existed
                if (domain === 'saves' || domain === 'resourcepacks' || domain === 'modpacks') {
                    const tempZipPath = this.getTempPath(suggestedName);
                    const { include, task, end } = openCompressedStreamTask(tempZipPath);

                    await include('', path);
                    end();
                    await task.execute().wait();
                    // zip and import
                    this.resourceService.addResource({
                        path: tempZipPath,

                    });
                    await this.resourceService.importResource({ path: tempZipPath, type: resourceType });
                    await unlink(tempZipPath);
                } else {
                    throw new Error(); // TODO: throw correct error
                }
            }
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
            if (!resource && fileType === 'zip' || ext === '.jar') {
                await this.resourceService.importResource({ path, type });
            }
        }

        await rename(this.getTempPath(sha1(Buffer.from(path))), '');
    }

    async readFileMetadata(options: ReadFileMetadataOptions): Promise<FileMetadata> {
        const { path, hint } = options;
        const fileStat = await stat(path);
        const result: FileMetadata = {
            path,
            type: 'unknown',
            fileType: 'unknown',
            displayName: basename(path),
            metadata: {},
            uri: '',
            existed: false,
        };
        if (fileStat.isDirectory()) {
            const { type: resourceType, suggestedName, uri, metadata, icon } = await readResourceHeader(path, hint);
            result.displayName = suggestedName;
            result.existed = !!this.resourceService.getResourceByKey(uri);
            result.type = resourceType as any;
            result.metadata = metadata;
            result.uri = uri;

            await writeFile(this.getTempPath(`${sha1(Buffer.from(path))}.png`), icon);
            await writeFile(this.getTempPath(`${sha1(Buffer.from(path))}.json`), JSON.stringify(metadata));
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
            result.fileType = fileType;
            if (resource) {
                // resource existed
                result.displayName = resource.name;
                result.existed = true;
                result.type = resource.type as any;
                result.metadata = resource.metadata;
                result.uri = resource.uri[0];
            } else if (fileType === 'zip' || ext === '.jar' || ext === '.litemod') {
                const { type: resourceType, suggestedName, uri, metadata, icon } = await readResourceHeader(path, hint);
                result.displayName = suggestedName;
                result.existed = !!this.resourceService.getResourceByKey(uri);
                result.type = resourceType as any;
                result.metadata = metadata;
                result.uri = uri;

                await writeFile(this.getTempPath(`${sha1(Buffer.from(path))}.png`), icon);
                await writeFile(this.getTempPath(`${sha1(Buffer.from(path))}.json`), JSON.stringify(metadata));
            }
        }
        return result;
    }

    async parseFiles(options: ReadFileMetadataOptions[]): Promise<FileMetadata[]> {
        return Promise.all(options.map((file) => this.readFileMetadata(file)));
    }
}
