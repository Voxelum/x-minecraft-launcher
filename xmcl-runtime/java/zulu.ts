import { DownloadBaseOptions } from '@xmcl/file-transfer';
import { DownloadTask, UnzipTask } from '@xmcl/installer';
import { task } from '@xmcl/task';
import { open, readAllEntries } from '@xmcl/unzip';
import { createReadStream, readJson, unlink, writeFile } from 'fs-extra';
import { join } from 'path';
import { pipeline } from 'stream/promises';
import { extract } from 'tar-stream';
import { createGunzip } from 'zlib';
import { LauncherApp } from '~/app';
import index from './zulu.json';
import { existsSync } from 'fs';

export interface ZuluJRE {
  features: string[];
  architecture: string;
  os: string;
  sha256: string;
  size: number;
  url: string;
}

export function installZuluJavaTask(jre: ZuluJRE, destination: string, version: number, options: DownloadBaseOptions) {
  return task('installJre', async function () {
    const packedFile = join(destination, '.tmp')
    await this.yield(new DownloadTask({
      url: jre.url,
      destination: packedFile,
      validator: {
        algorithm: 'sha256',
        hash: jre.sha256,
      },
      expectedTotal: jre.size,
    }))
    if (jre.url.endsWith('.tar.gz')) {
      await pipeline(
        createReadStream(packedFile),
        createGunzip(),
        extract(),
      )
    } else {
      // zip
      const zipFile = await open(packedFile)
      const entries = await readAllEntries(zipFile)
      await this.yield(new UnzipTask(zipFile, entries, destination))
    }
    await unlink(packedFile)
  }, { version })
}

export async function setupZuluCache(app: LauncherApp) {
  const filePath = join(app.appDataPath, 'zulu.json')
  if (!existsSync(filePath)) {
    await writeFile(filePath, JSON.stringify(index, null, 2))
  }

  const content = await readJson(filePath).catch(() => index) as typeof index

  const response = await app.fetch('https://api.xmcl.app/zulu', {
    headers: {
      ['If-Modified-Since']: content.modified,
    }
  })
  if (response.ok) {
    await writeFile(filePath, JSON.stringify(await response.json(), null, 2))
  }
}

export async function getZuluJRE(app: LauncherApp, type:
  'java-runtime-alpha' |
  'java-runtime-beta' |
  'java-runtime-gamma' |
  'java-runtime-gamma-snapshot' |
  'java-runtime-delta' |
  'jre-legacy'
) {
  const zuluCachePath = join(app.appDataPath, 'zulu.json')
  const content = await readJson(zuluCachePath).catch(() => index) as typeof index
  const array = content[type] || []
  const targets = array.filter(item => item.os === process.platform && item.architecture === process.arch)
  if (targets.length === 0) {
    throw new Error(`No zulu jre found for ${process.platform} ${process.arch}`)
  }
  const withMusl = targets.find(item => item.features.includes('musl'))
  if (withMusl) {
    return withMusl
  }
  const withJfx = targets.find(item => item.features.includes('javafx'))
  if (withJfx) {
    return withJfx
  }
  return targets[0] as ZuluJRE
}