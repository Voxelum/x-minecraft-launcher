import { open, readAllEntries } from '@xmcl/unzip'
import { mkdtemp, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import { ZipFile } from 'yazl'
import { addExportFileAsOverride, getModrinthProfileFiles } from './exportArchiveFiles'

function finishZip(zip: ZipFile): Promise<Buffer> {
  zip.end()
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    zip.outputStream.on('data', (chunk: Buffer) => chunks.push(chunk))
    zip.outputStream.on('end', () => resolve(Buffer.concat(chunks)))
    zip.outputStream.on('error', reject)
  })
}

async function getEntryNames(zip: ZipFile) {
  const archive = await open(await finishZip(zip))
  return (await readAllEntries(archive)).map(entry => entry.fileName).sort()
}

describe('modpack export archive files', () => {
  const directories: string[] = []

  afterEach(async () => {
    await Promise.all(directories.splice(0).map(path => rm(path, { recursive: true, force: true })))
  })

  it('routes server-only overrides to Modrinth server-overrides and a CurseForge server pack', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'xmcl-modpack-export-'))
    directories.push(directory)
    const clientFile = join(directory, 'client.txt')
    const serverFile = join(directory, 'server.txt')
    await Promise.all([
      writeFile(clientFile, 'client'),
      writeFile(serverFile, 'server'),
    ])

    const curseforge = new ZipFile()
    const curseforgeServer = new ZipFile()
    const modrinth = new ZipFile()
    const archives = { curseforge, curseforgeServer, modrinth }

    addExportFileAsOverride(archives, clientFile, { path: 'config/client.txt' })
    addExportFileAsOverride(archives, serverFile, {
      path: 'config/server.txt',
      source: 'server/config/server.txt',
      override: true,
      env: { client: 'unsupported', server: 'required' },
    })

    await expect(getEntryNames(curseforge)).resolves.toEqual(['overrides/config/client.txt'])
    await expect(getEntryNames(curseforgeServer)).resolves.toEqual(['config/server.txt'])
    await expect(getEntryNames(modrinth)).resolves.toEqual([
      'overrides/config/client.txt',
      'server-overrides/config/server.txt',
    ])
  })

  it('keeps same-path client and server files in a universal Modrinth pack', () => {
    const client = { path: 'config/shared.toml', source: 'config/shared.toml' }
    const server = {
      path: 'config/shared.toml',
      source: 'server/config/shared.toml',
      override: true,
      env: { client: 'unsupported' as const, server: 'required' as const },
    }
    const files = [client, server]

    expect(getModrinthProfileFiles(files, 'universal')).toEqual([client, server])
    expect(getModrinthProfileFiles(files, 'client')).toEqual([{ ...client, env: undefined }])
    expect(getModrinthProfileFiles(files, 'server')).toEqual([{ ...server, env: undefined }])
  })
})