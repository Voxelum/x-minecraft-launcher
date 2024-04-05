import { ThemeService as IThemeService, MediaData, ThemeData, ThemeServiceKey } from '@xmcl/runtime-api'
import { LauncherApp } from '../app/LauncherApp'
import { Inject, LauncherAppKey } from '~/app'
import { AbstractService, ExposeServiceKey } from '~/service'
import { fromFile } from 'file-type'
import { basename, join } from 'path'
import { ensureDir, remove, copyFile, unlink, writeJson, existsSync, readJSON } from 'fs-extra'
import { ZipTask } from '~/util/zip'

@ExposeServiceKey(ThemeServiceKey)
export class ThemeService extends AbstractService implements IThemeService {
  constructor(@Inject(LauncherAppKey) app: LauncherApp) {
    super(app)
  }

  async addMedia(filePath: string): Promise<MediaData> {
    const fileType = await fromFile(filePath)
    if (fileType?.mime.startsWith('audio') || fileType?.mime.startsWith('video') || fileType?.mime.startsWith('image')) {
      const targetPath = this.getAppDataPath('themes', basename(filePath))
      await copyFile(filePath, targetPath)
      return {
        url: 'http://launcher/theme-media/' + basename(filePath),
        type: fileType.mime.startsWith('audio') ? 'audio' : fileType.mime.startsWith('video') ? 'video' : 'image',
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

  // async loadTheme(name: string): Promise<ThemeData> {
  //   const folder = this.getAppDataPath('themes', name)
  //   if (!existsSync(folder)) {
  //     throw new Error('Theme does not exist')
  //   }
  //   const theme = await readJSON(join(folder, 'theme.json')) as ThemeData
  //   if (theme.backgroundMusic) {
  //     theme.backgroundMusic = theme.backgroundMusic.map(media => ({
  //       ...media,
  //       url: 'http://launcher/theme-media/' + name + '/' + basename(media.url),
  //     }))
  //   }
  //   if (theme.backgroundPicture) {
  //     theme.backgroundPicture.url = 'http://launcher/theme-media/' + name + '/' + basename(theme.backgroundPicture.url)
  //   }
  //   if (theme.font) {
  //     theme.font.url = 'http://launcher/theme-media/' + name + '/' + basename(theme.font.url)
  //   }
  //   return theme
  // }

  // async saveTheme(theme: ThemeData): Promise<ThemeData> {
  //   const folder = this.getAppDataPath('themes', theme.name)

  //   if (existsSync(folder)) {
  //     throw new Error('Theme already exists')
  //   }

  //   await ensureDir(folder)
  //   await writeJson(join(folder, 'theme.json'), theme)

  //   if (theme.backgroundMusic) {
  //     for (const media of theme.backgroundMusic) {
  //       const path = join(folder, basename(media.url))
  //       await copyFile(media.url, path)
  //     }
  //   }
  //   if (theme.backgroundPicture) {
  //     const path = join(folder, basename(theme.backgroundPicture.url))
  //     await copyFile(theme.backgroundPicture.url, path)
  //   }
  //   if (theme.font) {
  //     const path = join(folder, basename(theme.font.url))
  //     await copyFile(theme.font.url, path)
  //   }

  //   const newTheme: ThemeData = {
  //     ...theme,
  //     backgroundMusic: theme.backgroundMusic?.map(media => ({
  //       ...media,
  //       url: 'http://launcher/theme-media/' + theme.name + '/' + basename(media.url),
  //     })),
  //     backgroundPicture: theme.backgroundPicture && {
  //       ...theme.backgroundPicture,
  //       url: 'http://launcher/theme-media/' + theme.name + '/' + basename(theme.backgroundPicture.url),
  //     },
  //     font: theme.font && {
  //       ...theme.font,
  //       url: 'http://launcher/theme-media/' + theme.name + '/' + basename(theme.font.url),
  //     },
  //   }

  //   return newTheme
  // }

  async removeTheme(name: string): Promise<void> {
    const folder = this.getAppDataPath('themes', name)

    if (!existsSync(folder)) {
      throw new Error('Theme does not exist')
    }

    await remove(folder)
  }

  async exportTheme(data: ThemeData, destinationFolder: string): Promise<string> {
    // zip the theme folder and rename to .xtheme
    const folder = this.getAppDataPath('themes', data.name)
    if (!existsSync(folder)) {
      throw new Error('Theme does not exist')
    }
    const zipPath = destinationFolder + '/' + name + '.xtheme'
    const zipTask = new ZipTask(zipPath)
    await zipTask.includeAs(folder)
    return zipPath
  }

  async importTheme(zipFilePath: string): Promise<ThemeData> {
    throw new Error('Method not implemented.')
  }
}
