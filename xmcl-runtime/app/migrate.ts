import { copy, ensureDir, existsSync, readdir, readlink, remove, rename, rmdir, stat, writeFile } from 'fs-extra'
import { join, resolve } from 'path'
import { Logger } from '~/infra'
import type { LauncherApp } from './LauncherApp'
import { isSystemError } from '@xmcl/utils'

/**
 * Move `from` to `to`.
 *
 * Unlike a plain `rename`, this merges into an existing destination directory
 * instead of failing with `ENOTEMPTY`. This matters because the destination
 * validation explicitly accepts an existing XMCL data directory as a target,
 * and a plain rename of `oldRoot/versions -> newRoot/versions` throws when
 * `newRoot/versions` already exists, which previously caused the whole
 * migration to roll back silently ("nothing happens").
 *
 * Falls back to copy + remove across different volumes (`EXDEV`).
 */
async function move(from: string, to: string) {
  const fromStat = await stat(from).catch(() => undefined)
  if (!fromStat) return
  const toStat = await stat(to).catch(() => undefined)

  // Both sides are directories: merge child by child instead of failing.
  if (fromStat.isDirectory() && toStat?.isDirectory()) {
    const children = await readdir(from)
    for (const child of children) {
      await move(join(from, child), join(to, child))
    }
    // Only removes the source directory once it is empty.
    await rmdir(from).catch(() => { })
    return
  }

  try {
    // The source is authoritative during a migration: replace an existing
    // destination file so the rename below does not fail (e.g. on Windows).
    if (toStat && !fromStat.isDirectory()) {
      await remove(to)
    }
    await rename(from, to)
  } catch (e) {
    if (isSystemError(e) && e.code === 'EXDEV') {
      // Different volume: rename is impossible, copy then remove.
      if (fromStat.isDirectory()) {
        await ensureDir(to)
        const children = await readdir(from)
        for (const child of children) {
          await move(join(from, child), join(to, child))
        }
        await rmdir(from).catch(() => { })
      } else {
        // Skip symlinks: their target may live outside the migrated tree.
        const link = await readlink(from).catch(() => null)
        if (!link) {
          await copy(from, to, { overwrite: true, preserveTimestamps: true })
          await remove(from)
        }
      }
    } else {
      throw e
    }
  }
}

/**
 * Relocate launcher state that used to live in `appData` into the game data
 * root, so it travels with the data on a migration and so each root is
 * self-contained.
 *
 * This runs once for existing installs: the files are only moved when they
 * exist in `appData` and are not already present in the root. When the root
 * and `appData` are the same directory there is nothing to do.
 */
export async function ensureGameDataFilesInRoot(appDataPath: string, gameRoot: string, logger: Logger) {
  if (resolve(appDataPath) === resolve(gameRoot)) return

  const relocate = async (name: string) => {
    const from = join(appDataPath, name)
    const to = join(gameRoot, name)
    try {
      // Never clobber a copy that already exists at the root.
      if (existsSync(from) && !existsSync(to)) {
        logger.log(`Relocate game data file into root: ${from} -> ${to}`)
        await move(from, to)
      }
    } catch (e) {
      logger.warn(`Failed to relocate ${from} -> ${to}`, e)
    }
  }

  await relocate('instances.json')

  // Move the resource database together with its WAL sidecars, gated on the
  // main file so the database is never split from its journal.
  const dbFrom = join(appDataPath, 'resources.sqlite')
  const dbTo = join(gameRoot, 'resources.sqlite')
  if (existsSync(dbFrom) && !existsSync(dbTo)) {
    await relocate('resources.sqlite')
    await relocate('resources.sqlite-wal')
    await relocate('resources.sqlite-shm')
  }
}

export async function handleMigrateRoot(source: string, logger: Logger, app: LauncherApp) {
  // Use the last occurrence: a stale `--migrate` can be carried forward into a
  // relaunch (e.g. by the updater reusing the current argv), so the freshest
  // destination wins.
  const migrateIndex = process.argv.lastIndexOf('--migrate')
  const destination = process.argv[migrateIndex + 1]
  if (migrateIndex === -1 || !destination) {
    return source
  }
  // Nothing to do if the destination is already the current root. This avoids
  // popping the migration window (and useless work) when a stale `--migrate`
  // flag survives a relaunch.
  if (resolve(source) === resolve(destination)) {
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
    'servers.dat',
    'instances.json',
    'resources.sqlite',
    'resources.sqlite-wal',
    'resources.sqlite-shm',
  ]
  const finished = [] as Array<{ from: string, to: string }>
  try {
    logger.log(`Try to use rename to migrate the files: ${source} -> ${destination}`)

    // The progress window is purely cosmetic — never let its failure abort
    // the migration itself.
    Promise.resolve(app.controller.startMigrate()).catch((e) => {
      logger.warn('Failed to show the migration window', e)
    })

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