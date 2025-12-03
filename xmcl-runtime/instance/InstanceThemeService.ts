import { InstanceThemeService as IInstanceThemeService, InstanceThemeServiceKey, MediaData, ThemeData } from '@xmcl/runtime-api'
import { fromFile } from 'file-type'
import { copyFile, ensureDir, existsSync, readJson, rm, unlink, writeJSON } from 'fs-extra'
import { basename, join, resolve } from 'path'
import { Inject, LauncherAppKey, kGameDataPath, PathResolver } from '~/app'
import { AbstractService, ExposeServiceKey } from '~/service'
import { LauncherApp } from '../app/LauncherApp'

@ExposeServiceKey(InstanceThemeServiceKey)
export class InstanceThemeService extends AbstractService implements IInstanceThemeService {
  constructor(
    @Inject(LauncherAppKey) app: LauncherApp,
    @Inject(kGameDataPath) private getPath: PathResolver,
  ) {
    super(app)
  }

  async getInstanceTheme(instancePath: string): Promise<ThemeData | undefined> {
    const themePath = join(instancePath, 'theme.json')
    return readJson(themePath).catch(() => undefined) as Promise<ThemeData | undefined>
  }

  async setInstanceTheme(instancePath: string, theme: ThemeData | undefined): Promise<void> {
    const themePath = join(instancePath, 'theme.json')
    if (theme) {
      return writeJSON(themePath, theme)
    } else {
      return rm(themePath, { force: true }).catch(() => undefined)
    }
  }

  async addMedia(instancePath: string, filePath: string): Promise<MediaData> {
    const fileType = await fromFile(filePath)
    if (fileType?.mime.startsWith('audio') || fileType?.mime.startsWith('video') || fileType?.mime.startsWith('image') || fileType?.mime.startsWith('font')) {
      const themeFolder = join(instancePath, 'theme')
      const targetPath = join(themeFolder, basename(filePath))
      await ensureDir(themeFolder)
      await copyFile(filePath, targetPath)
      return {
        url: 'http://launcher/instance-theme-media/' + basename(filePath) + '?instancePath=' + encodeURIComponent(instancePath),
        type: fileType.mime.slice(0, fileType.mime.indexOf('/')) as 'audio' | 'video' | 'image' | 'font',
        mimeType: fileType.mime,
      }
    } else {
      throw new Error('Unsupported media type')
    }
  }

  async removeMedia(instancePath: string, url: string): Promise<void> {
    // Extract file name from URL (before the query string)
    const urlObj = new URL(url)
    const rawFileName = urlObj.pathname.substring('/instance-theme-media/'.length)
    // Prevent path traversal by using only the basename
    const fileName = basename(rawFileName)
    if (!fileName || fileName === '.' || fileName === '..') {
      return
    }
    const themeFolder = resolve(instancePath, 'theme')
    const filePath = resolve(themeFolder, fileName)
    // Validate the resolved path is under the theme folder
    if (!filePath.startsWith(themeFolder)) {
      return
    }
    try {
      const fileType = await fromFile(filePath)
      if (fileType?.mime.startsWith('audio') || fileType?.mime.startsWith('video') || fileType?.mime.startsWith('image') || fileType?.mime.startsWith('font')) {
        await unlink(filePath)
      }
    } catch {
      // File doesn't exist or can't be accessed, ignore
    }
  }

  async copyMediaFromGlobal(instancePath: string, url: string): Promise<MediaData> {
    // Extract file name from global theme URL
    const fileName = basename(url.substring('http://launcher/theme-media/'.length))
    if (!fileName || fileName === '.' || fileName === '..') {
      throw new Error('Invalid media URL')
    }
    const sourcePath = this.getAppDataPath('themes', fileName)
    if (!existsSync(sourcePath)) {
      throw new Error('Source media file not found')
    }
    const fileType = await fromFile(sourcePath)
    if (!fileType?.mime.startsWith('audio') && !fileType?.mime.startsWith('video') && !fileType?.mime.startsWith('image') && !fileType?.mime.startsWith('font')) {
      throw new Error('Unsupported media type')
    }
    const themeFolder = join(instancePath, 'theme')
    const targetPath = join(themeFolder, fileName)
    await ensureDir(themeFolder)
    await copyFile(sourcePath, targetPath)
    return {
      url: 'http://launcher/instance-theme-media/' + fileName + '?instancePath=' + encodeURIComponent(instancePath),
      type: fileType.mime.slice(0, fileType.mime.indexOf('/')) as 'audio' | 'video' | 'image' | 'font',
      mimeType: fileType.mime,
    }
  }

  async showMediaInFolder(instancePath: string, url: string): Promise<void> {
    // Extract file name from URL (before the query string)
    const urlObj = new URL(url)
    const rawFileName = urlObj.pathname.substring('/instance-theme-media/'.length)
    const fileName = basename(rawFileName)
    if (!fileName || fileName === '.' || fileName === '..') {
      return
    }
    const themeFolder = resolve(instancePath, 'theme')
    const filePath = resolve(themeFolder, fileName)
    if (!filePath.startsWith(themeFolder)) {
      return
    }
    if (existsSync(filePath)) {
      this.app.shell.showItemInFolder(filePath)
    }
  }
}
