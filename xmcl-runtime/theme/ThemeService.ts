import { ThemeService as IThemeService, MediaData, StoredTheme, ThemeData, ThemeServiceKey } from '@xmcl/runtime-api'
import { open, openEntryReadStream, readAllEntries } from '@xmcl/unzip'
import { fromFile } from 'file-type'
import { createWriteStream } from 'fs'
import { copyFile, emptyDir, ensureDir, existsSync, move, readdir, readJSON, remove, rename, unlink, writeJson } from 'fs-extra'
import { basename, dirname, join } from 'path'
import { pipeline } from 'stream/promises'
import { Inject, LauncherAppKey } from '~/app'
import { AbstractService, ExposeServiceKey } from '~/service'
import { writeZipFile } from '~/util/zip'
import { LauncherApp } from '../app/LauncherApp'
import { ZipFile } from 'yazl'

@ExposeServiceKey(ThemeServiceKey)
export class ThemeService extends AbstractService implements IThemeService {
  constructor(@Inject(LauncherAppKey) app: LauncherApp) {
    super(app, () => this.migrateThemeFolder())
  }

  /**
   * Migrate from old folder structure (themes/) to new structure (theme-media/ + theme.json)
   */
  private async migrateThemeFolder() {
    const oldThemesFolder = this.getAppDataPath('themes')
    const newMediaFolder = this.getAppDataPath('theme-media')
    const themeJsonPath = this.getAppDataPath('theme.json')

    // Check if migration is needed
    if (!existsSync(oldThemesFolder)) {
      return
    }

    // Check if there's a default.json in the old themes folder (old format)
    const defaultThemeFile = join(oldThemesFolder, 'default.json')
    if (!existsSync(defaultThemeFile)) {
      // No default theme to migrate, but might have media files
      // Check for any json files that might be theme configs
      const files = await readdir(oldThemesFolder).catch(() => [])
      const jsonFiles = files.filter(f => f.endsWith('.json'))

      if (jsonFiles.length === 0) {
        // No theme configs, just media files - move them to new location
        const mediaFiles = files.filter(f => !f.endsWith('.json') && !f.endsWith('.xtheme'))
        if (mediaFiles.length > 0 && !existsSync(newMediaFolder)) {
          this.log(`Migrating ${mediaFiles.length} media files from themes/ to theme-media/`)
          await ensureDir(newMediaFolder)
          for (const file of mediaFiles) {
            const srcPath = join(oldThemesFolder, file)
            const dstPath = join(newMediaFolder, file)
            await move(srcPath, dstPath, { overwrite: true }).catch(() => { })
          }
        }
        return
      }

      // Use the first json file found as the theme to migrate
      const themeFile = join(oldThemesFolder, jsonFiles[0])
      const themeData = await readJSON(themeFile).catch(() => undefined) as ThemeData | undefined
      if (themeData) {
        await this.migrateThemeData(themeData, oldThemesFolder, newMediaFolder, themeJsonPath)
      }
      return
    }

    // Read the default theme
    const themeData = await readJSON(defaultThemeFile).catch(() => undefined) as ThemeData | undefined
    if (!themeData) {
      return
    }

    await this.migrateThemeData(themeData, oldThemesFolder, newMediaFolder, themeJsonPath)
  }

  private async migrateThemeData(themeData: ThemeData, oldThemesFolder: string, newMediaFolder: string, themeJsonPath: string) {
    this.log('Migrating theme from old format to new format')

    // Collect all media URLs from the theme
    const mediaUrls = new Set<string>()
    for (const asset of Object.values(themeData.assets)) {
      if (Array.isArray(asset)) {
        for (const media of asset) {
          if (media.url?.startsWith('http://launcher/theme-media/')) {
            mediaUrls.add(media.url)
          }
        }
      } else if (asset?.url?.startsWith('http://launcher/theme-media/')) {
        mediaUrls.add(asset.url)
      }
    }

    // Create new media folder
    await ensureDir(newMediaFolder)

    // Move only the media files referenced by the theme
    for (const url of mediaUrls) {
      const fileName = url.substring('http://launcher/theme-media/'.length)
      const srcPath = join(oldThemesFolder, fileName)
      const dstPath = join(newMediaFolder, fileName)
      if (existsSync(srcPath)) {
        await move(srcPath, dstPath, { overwrite: true }).catch((e) => {
          this.warn(`Failed to move media file ${fileName}: ${e}`)
        })
      }
    }

    // Write the theme.json
    if (!existsSync(themeJsonPath)) {
      await writeJson(themeJsonPath, themeData, { spaces: 2 })
    }

    // Convert remaining .json files to .xtheme in themes folder
    const files = await readdir(oldThemesFolder).catch(() => [])
    for (const file of files) {
      if (file.endsWith('.json')) {
        const srcPath = join(oldThemesFolder, file)
        const themeName = file.replace('.json', '')
        // Skip if already migrated as current theme
        if (themeName === 'default' && existsSync(themeJsonPath)) {
          await unlink(srcPath).catch(() => { })
          continue
        }
        // Convert to xtheme
        const storedThemeData = await readJSON(srcPath).catch(() => undefined) as ThemeData | undefined
        if (storedThemeData) {
          await this.createXTheme(storedThemeData, oldThemesFolder, join(oldThemesFolder, `${themeName}.xtheme`))
          await unlink(srcPath).catch(() => { })
        }
      }
    }

    this.log('Theme migration completed')
  }

  private async createXTheme(data: ThemeData, mediaSourceFolder: string, destinationFile: string) {
    const zipFile = new ZipFile()
    for (const asset of Object.values(data.assets)) {
      if (Array.isArray(asset)) {
        for (const media of asset) {
          const url = media.url
          const fileName = url.substring(url.lastIndexOf('/') + 1)
          const realPath = join(mediaSourceFolder, fileName)
          if (existsSync(realPath)) {
            zipFile.addFile(realPath, `assets/${fileName}`)
          }
        }
      } else if (asset?.url) {
        const url = asset.url
        const fileName = url.substring(url.lastIndexOf('/') + 1)
        const realPath = join(mediaSourceFolder, fileName)
        if (existsSync(realPath)) {
          zipFile.addFile(realPath, `assets/${fileName}`)
        }
      }
    }
    zipFile.addBuffer(Buffer.from(JSON.stringify(data, null, 2)), 'theme.json')
    await writeZipFile(zipFile, destinationFile)
  }

  async showMediaItemInFolder(url: string): Promise<void> {
    const path = this.getAppDataPath('theme-media', url.substring('http://launcher/theme-media/'.length))
    if (!existsSync(path)) {
      return
    }
    this.app.shell.showItemInFolder(path)
  }

  async addMedia(filePath: string): Promise<MediaData> {
    const fileType = await fromFile(filePath)
    if (fileType?.mime.startsWith('audio') || fileType?.mime.startsWith('video') || fileType?.mime.startsWith('image') || fileType?.mime.startsWith('font')) {
      const targetPath = this.getAppDataPath('theme-media', basename(filePath))
      await ensureDir(this.getAppDataPath('theme-media'))
      await copyFile(filePath, targetPath)
      return {
        url: 'http://launcher/theme-media/' + basename(filePath),
        type: fileType.mime.slice(0, fileType.mime.indexOf('/')) as 'audio' | 'video' | 'image' | 'font',
        mimeType: fileType.mime,
      }
    } else {
      throw new Error('Unsupported media type')
    }
  }

  async removeMedia(url: string): Promise<void> {
    const path = this.getAppDataPath('theme-media', url.substring('http://launcher/theme-media/'.length))
    // path should be under appdata/theme-media
    if (!path.startsWith(this.getAppDataPath('theme-media'))) {
      return
    }
    const fileType = await fromFile(path).catch(() => undefined)
    if (fileType?.mime.startsWith('audio') || fileType?.mime.startsWith('video') || fileType?.mime.startsWith('image') || fileType?.mime.startsWith('font')) {
      await unlink(path).catch(() => { })
    }
  }

  async getCurrentTheme(): Promise<ThemeData | undefined> {
    const themeFile = this.getAppDataPath('theme.json')
    return readJSON(themeFile).catch(() => undefined) as Promise<ThemeData | undefined>
  }

  async setCurrentTheme(data: ThemeData): Promise<void> {
    const themeFile = this.getAppDataPath('theme.json')
    await writeJson(themeFile, data, { spaces: 2 })
  }

  async getStoredThemes(): Promise<StoredTheme[]> {
    const themesPath = this.getAppDataPath('themes')
    if (!existsSync(themesPath)) {
      return []
    }
    const files = await readdir(themesPath)
    const themes: StoredTheme[] = []
    for (const file of files) {
      if (file.endsWith('.xtheme')) {
        themes.push({
          name: file.replace('.xtheme', ''),
        })
      }
    }
    return themes
  }

  async saveThemeToStore(name: string): Promise<void> {
    const currentTheme = await this.getCurrentTheme()
    if (!currentTheme) {
      throw new Error('No current theme to save')
    }

    const themesPath = this.getAppDataPath('themes')
    await ensureDir(themesPath)

    const destinationFile = join(themesPath, `${name}.xtheme`)
    const mediaFolder = this.getAppDataPath('theme-media')

    await this.createXTheme(currentTheme, mediaFolder, destinationFile)
  }

  async loadThemeFromStore(name: string): Promise<ThemeData> {
    const themesPath = this.getAppDataPath('themes')
    const themeFile = join(themesPath, `${name}.xtheme`)

    if (!existsSync(themeFile)) {
      throw new Error('Theme not found')
    }

    // Import the theme, which will replace current theme
    return this.importTheme(themeFile)
  }

  async deleteStoredTheme(name: string): Promise<void> {
    const themesPath = this.getAppDataPath('themes')
    const themeFile = join(themesPath, `${name}.xtheme`)

    if (!existsSync(themeFile)) {
      throw new Error('Theme not found')
    }

    await unlink(themeFile)
  }

  async exportTheme(destinationFile: string): Promise<string> {
    const currentTheme = await this.getCurrentTheme()
    if (!currentTheme) {
      throw new Error('No current theme to export')
    }

    if (!destinationFile.endsWith('.xtheme')) {
      destinationFile += '.xtheme'
    }

    const mediaFolder = this.getAppDataPath('theme-media')
    await this.createXTheme(currentTheme, mediaFolder, destinationFile)

    return destinationFile
  }

  async importTheme(zipFilePath: string): Promise<ThemeData> {
    const zipFile = await open(zipFilePath)
    const entries = await readAllEntries(zipFile)
    const themeEntry = entries.find(e => e.fileName === 'theme.json')
    if (!themeEntry) {
      throw new Error('Invalid theme file: missing theme.json')
    }

    // Read theme.json from zip
    const readable = await openEntryReadStream(zipFile, themeEntry)
    const themeJsonContent = await new Promise<Buffer>((resolve, reject) => {
      const buffers: Buffer[] = []
      readable.on('data', (chunk) => { buffers.push(chunk) })
      readable.on('end', () => resolve(Buffer.concat(buffers)))
      readable.on('error', reject)
    })
    const data = JSON.parse(themeJsonContent.toString()) as ThemeData

    // Clear and recreate theme-media folder
    const mediaFolder = this.getAppDataPath('theme-media')
    await emptyDir(mediaFolder)

    // Extract assets to theme-media folder
    const promises: Promise<void>[] = []
    for (const e of entries) {
      if (e.fileName === 'theme.json') {
        continue
      }
      if (e.fileName.startsWith('assets/')) {
        const fileName = e.fileName.substring('assets/'.length)
        if (!fileName) continue
        const filePath = join(mediaFolder, fileName)
        await ensureDir(dirname(filePath))
        const entryReadable = await openEntryReadStream(zipFile, e)
        const writable = createWriteStream(filePath)
        promises.push(pipeline(entryReadable, writable))
      }
    }

    await Promise.all(promises)

    // Write theme.json
    await this.setCurrentTheme(data)

    // Automatically save the imported theme to store
    const themeName = basename(zipFilePath, '.xtheme')
    const themesPath = this.getAppDataPath('themes')
    await ensureDir(themesPath)
    const destinationFile = join(themesPath, `${themeName}.xtheme`)
    await copyFile(zipFilePath, destinationFile)

    return data
  }
}
