import { Resource } from '@universal/store/modules/resource';
import { ensureFile, link } from 'fs-extra';
import { join } from 'path';

export async function deployByLink(root: string, resource: Resource) {
    let targetPath = join(root, resource.domain, `${resource.name}${resource.ext}`);
    await ensureFile(targetPath);
    await link(resource.path, targetPath);
    return targetPath;
}
