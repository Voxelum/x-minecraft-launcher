import { XaeroMapsService as IXaeroMapsService, XaeroMapsServiceKey } from '@xmcl/runtime-api'
import { existsSync } from 'fs'
import { readdir, stat, ensureDir, remove } from 'fs-extra'
import { join, basename } from 'path'
import { Inject, LauncherAppKey, PathResolver, kGameDataPath } from '~/app'
import { kSettings } from '~/settings'
import { AbstractService, ExposeServiceKey } from '~/service'
import { LauncherApp } from '../app/LauncherApp'
import { linkDirectory, linkWithTimeoutOrCopy, missing, readdirIfPresent } from '../util/fs'

/**
 * Service to manage shared Xaero's Minimap and World Map data across instances
 */
@ExposeServiceKey(XaeroMapsServiceKey)
export class XaeroMapsService extends AbstractService implements IXaeroMapsService {
  private readonly XAERO_FOLDERS = ['XaeroMinimap', 'XaeroWorldMap']

  constructor(
    @Inject(LauncherAppKey) app: LauncherApp,
    @Inject(kGameDataPath) private getPath: PathResolver,
  ) {
    super(app)
  }

  getSharedMapsPath(): string {
    return this.getPath('shared-xaero-maps')
  }

  async setupSharedMaps(instancePath: string): Promise<void> {
    const settings = await this.app.registry.get(kSettings)
    if (!settings.xaeroMapsShared) {
      this.log(`Xaero maps sharing is disabled, skipping setup for ${instancePath}`)
      return
    }

    this.log(`Setting up shared Xaero maps for instance: ${instancePath}`)
    
    const sharedMapsPath = this.getSharedMapsPath()
    await ensureDir(sharedMapsPath)

    for (const folderName of this.XAERO_FOLDERS) {
      const instanceMapPath = join(instancePath, folderName)
      const sharedMapPath = join(sharedMapsPath, folderName)
      
      await ensureDir(sharedMapPath)

      // If instance folder exists and is not already linked
      if (existsSync(instanceMapPath)) {
        const instanceStat = await stat(instanceMapPath)
        const sharedStat = await stat(sharedMapPath)
        
        // Check if they're already the same (linked)
        if (instanceStat.ino === sharedStat.ino) {
          this.log(`${folderName} already linked for instance ${instancePath}`)
          continue
        }

        // Migrate existing data to shared location
        await this.migrateInstanceMapsToShared(instanceMapPath, sharedMapPath)
      }

      // Create link from instance to shared location
      if (await missing(instanceMapPath)) {
        try {
          await linkDirectory(sharedMapPath, instanceMapPath, this.logger)
          this.log(`Created link for ${folderName} in instance ${instancePath}`)
        } catch (error) {
          this.error(`Failed to create link for ${folderName}: ${error}`)
          throw error
        }
      }
    }
  }

  async removeSharedMaps(instancePath: string): Promise<void> {
    this.log(`Removing shared Xaero maps for instance: ${instancePath}`)
    
    for (const folderName of this.XAERO_FOLDERS) {
      const instanceMapPath = join(instancePath, folderName)
      
      if (existsSync(instanceMapPath)) {
        try {
          await remove(instanceMapPath)
          this.log(`Removed ${folderName} link from instance ${instancePath}`)
        } catch (error) {
          this.error(`Failed to remove ${folderName} link: ${error}`)
        }
      }
    }
  }

  async isSharedMapsEnabled(instancePath: string): Promise<boolean> {
    const settings = await this.app.registry.get(kSettings)
    if (!settings.xaeroMapsShared) {
      return false
    }

    // Check if any Xaero folder in the instance is linked to shared location
    for (const folderName of this.XAERO_FOLDERS) {
      const instanceMapPath = join(instancePath, folderName)
      const sharedMapPath = join(this.getSharedMapsPath(), folderName)
      
      if (existsSync(instanceMapPath) && existsSync(sharedMapPath)) {
        try {
          const instanceStat = await stat(instanceMapPath)
          const sharedStat = await stat(sharedMapPath)
          
          if (instanceStat.ino === sharedStat.ino) {
            return true
          }
        } catch (error) {
          this.warn(`Failed to check link status for ${folderName}: ${error}`)
        }
      }
    }
    
    return false
  }

  async migrateToSharedMaps(instancePath: string): Promise<void> {
    this.log(`Migrating Xaero maps to shared location for instance: ${instancePath}`)
    
    const sharedMapsPath = this.getSharedMapsPath()
    await ensureDir(sharedMapsPath)

    for (const folderName of this.XAERO_FOLDERS) {
      const instanceMapPath = join(instancePath, folderName)
      const sharedMapPath = join(sharedMapsPath, folderName)
      
      if (existsSync(instanceMapPath)) {
        await this.migrateInstanceMapsToShared(instanceMapPath, sharedMapPath)
      }
    }
  }

  private async migrateInstanceMapsToShared(instanceMapPath: string, sharedMapPath: string): Promise<void> {
    this.log(`Migrating maps from ${instanceMapPath} to ${sharedMapPath}`)
    
    try {
      await ensureDir(sharedMapPath)
      
      // Get all files/folders in instance map directory
      const instanceContents = await readdirIfPresent(instanceMapPath)
      
      for (const item of instanceContents) {
        const instanceItemPath = join(instanceMapPath, item)
        const sharedItemPath = join(sharedMapPath, item)
        
        // If item doesn't exist in shared location, move it there
        if (await missing(sharedItemPath)) {
          const itemStat = await stat(instanceItemPath)
          
          if (itemStat.isDirectory()) {
            // For directories, use linkDirectory
            await linkDirectory(instanceItemPath, sharedItemPath, this.logger)
          } else {
            // For files, use linkWithTimeoutOrCopy
            await linkWithTimeoutOrCopy(instanceItemPath, sharedItemPath)
          }
          
          this.log(`Migrated ${item} to shared location`)
        } else {
          this.log(`${item} already exists in shared location, skipping`)
        }
      }
      
      // Remove the original instance directory and replace with link
      await remove(instanceMapPath)
      await linkDirectory(sharedMapPath, instanceMapPath, this.logger)
      
    } catch (error) {
      this.error(`Failed to migrate maps: ${error}`)
      throw error
    }
  }
}