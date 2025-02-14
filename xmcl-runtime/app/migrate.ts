import { copy, readdir, readlink, remove, rename, writeFile } from 'fs-extra'
import { join } from 'path'
import { Logger } from '~/logger'
import type { LauncherApp } from './LauncherApp'
import { isSystemError } from '~/util/error'

async function move(from: string, to: string) {
  await rename(from, to).catch(async (e) => {
    if (isSystemError(e) && e.code === 'EXDEV') {
      await copy(from, to, {
        errorOnExist: true,
        preserveTimestamps: true,
        filter: async (src, dest) => {
          const link = await readlink(src).catch(() => null)
          return !link
        }
      })
      await remove(from)
    } else {
      throw e
    }
  })
}

export async function handleMigrateRoot(source: string, logger: Logger, app: LauncherApp) {
  const migrateIndex = process.argv.indexOf('--migrate')
  const destination = process.argv[migrateIndex + 1]
  if (migrateIndex === -1 || !destination) {
    return source
  }
  const candidates = [
    'assets',
    'instances',
    'jre',
    'libraries',
    'labymod-neo',
    'modpacks',
    'mods',
    'resourcepacks',
    'saves',
    'shaderpacks',
    'versions',
    'authlib-injection.json',
    'ely-authlib.json',
    'launcher_profiles.json',
    'options.txt',
  ]
  const finished = [] as Array<{ from: string, to: string }>
  try {
    logger.log(`Try to use rename to migrate the files: ${source} -> ${destination}`)

    app.controller.startMigrate()

    let from = source
    let to = destination
    let progress = 0
    let total = candidates.length
    app.controller.handle('migration-get-progress', () => {
      return { from, to, progress, total }
    })

    const files = await readdir(source).then(files => files.filter(file => candidates.includes(file)))
    total = files.length
    for (const file of files) {
      from = join(source, file)
      to = join(destination, file)
      progress = files.indexOf(file)
      try {
        logger.log(`Move ${from} -> ${to}`)
        app.controller.broadcast('migration-event', { event: 'progress', payload: { from, to, progress, total } })
        await move(from, to)
        finished.push({ from, to })
        app.controller.broadcast('migration-event', { event: 'progress', payload: { from, to, progress: progress + 1, total } })
      } catch (e) {
        logger.warn(`Fail to move ${from} -> ${to}`, e)
        app.controller.broadcast('migration-event', { event: 'error', payload: { from, to, error: e } })
        throw e
      }
    }

    await writeFile(join(app.appDataPath, 'root'), destination)
    app.controller.endMigrate({
      from: source,
      to: destination,
    })
    return destination
  } catch (e) {
    // rollback
    logger.warn(`Fail to migrate, rollback`, e)
    for (const { from, to } of finished) {
      try {
        logger.log(`Rollback ${to} -> ${from}`)
        await move(to, from)
      } catch (e) {
        logger.warn(`Fail to rollback ${to} -> ${from}`, e)
      }
    }
    app.controller.endMigrate()
    return source
  }
}