import { ensureDir } from 'fs-extra'
import { lstat, readlink, rename, unlink } from 'fs/promises'
import { isSystemError } from './error'
import { ENOENT_ERROR, createSymbolicLink } from './fs'
import { Logger } from './log'

/**
 * Try to link folder as symbolic link to the resource folder.
 * @return `true` if linked, `false` means dictionary
 */
export async function tryLink(srcPath: string, destPath: string, logger: Logger, isManaged: (path: string) => boolean) {
  logger.log(`Linking the at domain to ${destPath}`)
  const stat = await lstat(destPath).catch((e) => {
    if (isSystemError(e) && e.code === ENOENT_ERROR) {
      return
    }
    throw e
  })
  if (stat) {
    if (stat.isSymbolicLink()) {
      if (await readlink(destPath) === srcPath) {
        logger.log(`Skip linking the at domain as it already linked: ${destPath}`)
        return true
      }
      logger.log(`Relink the domain: ${destPath}`)
      await unlink(destPath)
    } else {
      // Skip for directory
      if (stat.isDirectory()) {
        return false
      } else {
        await rename(destPath, `${destPath}_backup`)
      }
    }
  } else if (!isManaged(destPath)) {
    // do not link if this is not an managed instance
    await ensureDir(destPath)
    return false
  }

  await createSymbolicLink(srcPath, destPath, logger)
  return true
}

//   async ensureResourcePacks() {
//   if (!this.active) return
//   if (this.linked) return
//   const promises: Promise<void>[] = []
//   for (let fileName of this.gameSettingService.state.options.resourcePacks) {
//     if (fileName === 'vanilla') {
//       continue
//     }
//     fileName = fileName.startsWith('file/') ? fileName.slice(5) : fileName
//     const src = this.getPath(ResourceDomain.ResourcePacks, fileName)
//     const dest = join(this.active, ResourceDomain.ResourcePacks, fileName)
//     if (!existsSync(dest)) {
//       promises.push(linkWithTimeoutOrCopy(src, dest).catch((e) => this.error(e)))
//     }
//   }
//   await Promise.all(promises)
// }
