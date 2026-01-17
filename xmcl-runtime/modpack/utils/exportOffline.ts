import { ResolvedVersion } from '@xmcl/core';
import { exists, readFile } from 'fs-extra';
import { basename, join, resolve } from 'path';
import { ZipFile } from 'yazl';

export async function exportOfflineModpack(zipFile: ZipFile, root: string, version: ResolvedVersion) {
  const assetsJson = resolve(root, 'assets', 'indexes', `${version.assets}.json`)
  zipFile.addFile(assetsJson, `assets/indexes/${version.assets}.json`)
  const objects = await readFile(assetsJson, 'utf8').then(JSON.parse).then(manifest => manifest.objects)
  for (const hash of Object.keys(objects).map(k => objects[k].hash)) {
    zipFile.addFile(resolve(root, 'assets', 'objects', hash.substring(0, 2), hash), `assets/objects/${hash.substring(0, 2)}/${hash}`)
  }

  const versionsChain = version.pathChain
  for (const versionPath of versionsChain) {
    const versionId = basename(versionPath)
    if (await exists(join(versionPath, `${versionId}.jar`))) {
      zipFile.addFile(join(versionPath, `${versionId}.jar`), `versions/${versionId}/${versionId}.jar`)
    }
    zipFile.addFile(join(versionPath, `${versionId}.json`), `versions/${versionId}/${versionId}.json`)
  }

  // add libraries
  for (const lib of version.libraries) {
    zipFile.addFile(resolve(root, 'libraries', lib.download.path),
      `libraries/${lib.download.path}`)
  }
}