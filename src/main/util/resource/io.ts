import filenamify from 'filenamify';
import { ensureFile, unlink, writeFile } from 'fs-extra';
import { basename, resolve, join } from 'path';
import { ResourceBuilder, getResourceFromBuilder, Resource } from './index';

/**
 * Commit the resource to the disk
 */
export async function commitResourceOnDisk(builder: ResourceBuilder, data: Buffer, root: string) {
    let name = filenamify(builder.name, { replacement: '-' });

    let slice = builder.hash.slice(0, 6);

    let filePath = join(root, builder.domain, `${name}.${slice}${builder.ext}`);
    let metadataPath = join(root, builder.domain, `${name}.${slice}.json`);
    let iconPath = join(root, builder.domain, `${name}.${slice}.png`);

    filePath = resolve(filePath);
    metadataPath = resolve(metadataPath);
    iconPath = resolve(iconPath);

    builder.path = filePath;

    await ensureFile(filePath);
    await writeFile(filePath, data);
    await writeFile(metadataPath, JSON.stringify(getResourceFromBuilder(builder), null, 4));
    if (builder.icon) {
        await writeFile(iconPath, builder.icon);
    }
}

export async function discardResourceOnDisk(resource: Readonly<Resource>, root: string) {
    let baseName = basename(resource.path, resource.ext);

    let filePath = resource.path;
    let metadataPath = join(root, resource.domain, `${baseName}.json`);
    let iconPath = join(root, resource.domain, `${baseName}.png`);

    await unlink(filePath);
    await unlink(metadataPath);
    try {
        await unlink(iconPath);
    } catch { }
}
