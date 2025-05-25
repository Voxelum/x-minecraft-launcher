import { DownloadBaseOptions } from '@xmcl/file-transfer';
import { DownloadTask, UnzipTask } from '@xmcl/installer';
import { task } from '@xmcl/task';
import { open, readAllEntries } from '@xmcl/unzip';
import { createReadStream, ensureDir, readJson, symlink, unlink, writeFile } from 'fs-extra';
import { basename, dirname, join } from 'path';
import { pipeline } from 'stream/promises';
import { extract } from 'tar-stream';
import { createGunzip } from 'zlib';
import { LauncherApp } from '~/app';
import index from './zulu.json';
import { createWriteStream, existsSync } from 'fs';

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
    const packedFile = join(destination, basename(jre.url))
    await this.yield(new DownloadTask({
      url: jre.url,
      destination: packedFile,
      validator: {
        algorithm: 'sha256',
        hash: jre.sha256,
      },
      expectedTotal: jre.size,
    }).setName('download'))
    if (jre.url.endsWith('.tar.gz')) {
      const extractStream = extract()

      const allPipe = [
        pipeline(
          createReadStream(packedFile),
          createGunzip(),
          extractStream,
        )
      ] as Promise<void>[]

      let first = ''
      let substring = 0
      const links = [] as {
        path: string
        linkTo: string
      }[]
      for await (const e of extractStream) {
        if (!first) {
          first = e.header.name
          if (first.endsWith('/') && jre.url.endsWith(e.header.name.substring(0, e.header.name.length - 1) + '.tar.gz')) {
            // ignore first folder
            substring = first.length
            continue
          }
        }
        const filePath = join(destination, join(e.header.name.substring(substring)))
        if (e.header.type === 'directory') {
          await ensureDir(filePath)
        } else if (e.header.linkname && e.header.type === 'symlink') {
          links.push({
            path: join(destination, e.header.linkname),
            linkTo: filePath,
          })
        } else if (e.header.type === 'file') {
          await ensureDir(dirname(filePath))
          allPipe.push(pipeline(
            e,
            createWriteStream(filePath)
          ))
        }
      }

      for (const l of links) {
        await symlink(l.path, l.linkTo)
      }

      await Promise.all(allPipe)
    } else {
      // zip
      const zipFile = await open(packedFile)
      try {
        const prefix = basename(jre.url).slice(0, -4) + '/'
        const entries = await readAllEntries(zipFile).then(ens => ens.filter(e => e.fileName !== prefix && !e.fileName.endsWith('/')))
        
        await this.yield(new UnzipTask(zipFile, entries, destination, (e) => {
          if (e.fileName.startsWith(prefix)) {
            return e.fileName.substring(prefix.length)
          }
          return e.fileName
        }).setName('decompress'))
      } finally {
        zipFile.close()
      }
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

  const response = await app.fetch('https://raw.githubusercontent.com/Voxelum/xmcl-static-resource/refs/heads/main/zulu.json', {
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