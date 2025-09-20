import { ResolvedVersion } from '@xmcl/core';
import { exists, readFile } from 'fs-extra';
import { basename, join, resolve } from 'path';
import { ZipTask } from '~/util/zip';

export async function exportOfflineModpack(zipTask: ZipTask, root: string, version: ResolvedVersion) {
  const assetsJson = resolve(root, 'assets', 'indexes', `${version.assets}.json`)
  zipTask.addFile(assetsJson, `assets/indexes/${version.assets}.json`)
  const objects = await readFile(assetsJson, 'utf8').then(JSON.parse).then(manifest => manifest.objects)
  for (const hash of Object.keys(objects).map(k => objects[k].hash)) {
    zipTask.addFile(resolve(root, 'assets', 'objects', hash.substring(0, 2), hash), `assets/objects/${hash.substring(0, 2)}/${hash}`)
  }

  const versionsChain = version.pathChain
  for (const versionPath of versionsChain) {
    const versionId = basename(versionPath)
    if (await exists(join(versionPath, `${versionId}.jar`))) {
      zipTask.addFile(join(versionPath, `${versionId}.jar`), `versions/${versionId}/${versionId}.jar`)
    }
    zipTask.addFile(join(versionPath, `${versionId}.json`), `versions/${versionId}/${versionId}.json`)
  }

  // add libraries
  for (const lib of version.libraries) {
    zipTask.addFile(resolve(root, 'libraries', lib.download.path),
      `libraries/${lib.download.path}`)
  }
}