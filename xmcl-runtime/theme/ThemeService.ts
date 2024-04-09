import { ThemeService as IThemeService, MediaData, ThemeData, ThemeServiceKey } from '@xmcl/runtime-api'
import { LauncherApp } from '../app/LauncherApp'
import { Inject, LauncherAppKey } from '~/app'
import { AbstractService, ExposeServiceKey } from '~/service'
import { fromFile } from 'file-type'
import { basename, join } from 'path'
import { ensureDir, remove, copyFile, unlink, writeJson, existsSync, readJSON } from 'fs-extra'
import { ZipTask } from '~/util/zip'
import { kTaskExecutor } from '~/task'
import { open, openEntryReadStream, readAllEntries } from '@xmcl/unzip'
import { createWriteStream } from 'fs'
import { pipeline } from 'stream/promises'

@ExposeServiceKey(ThemeServiceKey)
export class ThemeService extends AbstractService implements IThemeService {
  constructor(@Inject(LauncherAppKey) app: LauncherApp) {
    super(app)
  }

  async showMediaItemInFolder(url: string): Promise<void> {
    const path = this.getAppDataPath('themes', url.substring('http://launcher/theme-media/'.length))
    if (!existsSync(path)) {
      return
    }
    this.app.shell.showItemInFolder(path)
  }

  async addMedia(filePath: string): Promise<MediaData> {
    const fileType = await fromFile(filePath)
    if (fileType?.mime.startsWith('audio') || fileType?.mime.startsWith('video') || fileType?.mime.startsWith('image') || fileType?.mime.startsWith('font')) {
      const targetPath = this.getAppDataPath('themes', basename(filePath))
      await ensureDir(this.getAppDataPath('themes'))
      await copyFile(filePath, targetPath)
      return {
        url: 'http://launcher/theme-media/' + basename(filePath),
        type: fileType.mime.slice(0, fileType.mime.indexOf('/')) as 'audio' | 'video' | 'image' | 'font',
        mimeType: fileType.mime,
      }
    } else {
      throw new Error('.')
    }
  }

  async removeMedia(url: string): Promise<void> {
    const path = this.getAppDataPath('themes', url.substring('http://launcher/theme-media/'.length))
    // path should be under appdata
    if (!path.startsWith(this.getAppDataPath('themes'))) {
      return
    }
    const fileType = await fromFile(path)
    if (fileType?.mime.startsWith('audio') || fileType?.mime.startsWith('video') || fileType?.mime.startsWith('image')) {
      await unlink(path)
    }
  }

  async removeTheme(name: string): Promise<void> {
    const folder = this.getAppDataPath('themes', name)

    if (!existsSync(folder)) {
      throw new Error('Theme does not exist')
    }

    await remove(folder)
  }

  async exportTheme(data: ThemeData, destinationFile: string): Promise<string> {
    // zip the theme folder and rename to .xtheme
    if (!destinationFile.endsWith('xtheme')) {
      destinationFile += '.xtheme'
    }
    const zipPath = destinationFile
    const zipTask = new ZipTask(zipPath)
    for (const asset of Object.values(data.assets)) {
      if (asset instanceof Array) {
        for (const media of asset) {
          const url = media.url
          const fileName = url.substring(url.lastIndexOf('/') + 1)
          const realPath = this.getAppDataPath('themes', fileName)
          zipTask.addFile(realPath, `assets/${fileName}`)
        }
      } else {
        const url = asset.url
        const fileName = url.substring(url.lastIndexOf('/') + 1)
        const realPath = this.getAppDataPath('themes', fileName)
        zipTask.addFile(realPath, `assets/${fileName}`)
      }
    }
    zipTask.addBuffer(Buffer.from(JSON.stringify(data, null, 2)), 'theme.json')
    const submit = await this.app.registry.get(kTaskExecutor)
    await submit(zipTask)
    return zipPath
  }

  async importTheme(zipFilePath: string): Promise<ThemeData> {
    const zipFile = await open(zipFilePath)
    const entries = await readAllEntries(zipFile)
    const themeEntry = entries.find(e => e.fileName === 'theme.json')
    if (!themeEntry) {
      throw new Error('Invalid theme file')
    }
    const readable = await openEntryReadStream(zipFile, themeEntry)
    const themeJsonContent = await new Promise<Buffer>((resolve, reject) => {
      const buffers: Buffer[] = []
      readable.on('data', (chunk) => { buffers.push(chunk) })
      readable.on('end', () => resolve(Buffer.concat(buffers)))
      readable.on('error', reject)
    })
    const data = JSON.parse(themeJsonContent.toString()) as ThemeData

    const promises = [] as Promise<void>[]
    for (const e of entries) {
      if (e.fileName === 'theme.json') {
        continue
      }
      if (e.fileName.startsWith('assets/')) {
        const fileName = e.fileName.substring('assets/'.length)
        const filePath = this.getAppDataPath('themes', fileName)
        const readable = await openEntryReadStream(zipFile, e)
        const writable = createWriteStream(filePath)
        promises.push(pipeline(readable, writable))
      }
    }

    await Promise.all(promises)

    return data
  }
}
