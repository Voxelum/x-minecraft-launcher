import { File, FileUpdateAction, FileUpdateOperation, ResourceDomain, ResourceMetadata, ResourceState, UpdateResourcePayload } from '@xmcl/runtime-api'
import { FSWatcher } from 'chokidar'
import { randomBytes } from 'crypto'
import { existsSync } from 'fs'
import { copy, ensureDir, link } from 'fs-extra'
import { basename, dirname, extname, join, resolve, sep } from 'path'
import { Logger } from '~/logger'
import { jsonArrayFrom } from '~/sql/sqlHelper'
import { AggregateExecutor, WorkerQueue } from '~/util/aggregator'
import { AnyError, isSystemError } from '~/util/error'
import { EEXIST_ERROR, isHardLinked, linkOrCopyFile } from '~/util/fs'
import { toRecord } from '~/util/object'
import { ResourceContext } from './ResourceContext'
import { ResourceWorkerQueuePayload } from './ResourceWorkerQueuePayload'
import { getFile, getFiles } from './files'
import { generateResourceV3, pickMetadata } from './generateResource'
import { getOrParseMetadata } from './parseMetadata'
import { shouldIgnoreFile } from './pathUtils'
import { ResourceSnapshotTable } from './schema'
import { getDomainedPath, isSnapshotValid, takeSnapshot } from './snapshot'

function createRevalidateFunction(
  dir: string,
  context: ResourceContext,
  onResourceRemove: (path: string) => void,
  onResourceQueue: (job: ResourceWorkerQueuePayload) => void,
  onResourceEmit: ResouceEmitFunc,
  onResourcePostRevalidate: (files: File[]) => void,
) {
  async function getUpserts() {
    const entries = await getFiles(dir).catch((e) => {
      if (isSystemError(e)) {
        if (e.code === 'ENOENT') {
          return []
        }
      }
      throw e
    })
    const inos = entries.map(e => e.ino)
    const records: Record<string, ResourceSnapshotTable> = await context.db.selectFrom('snapshots')
      .selectAll()
      .where((eb) => eb.or([
        eb('domainedPath', 'like', `${dir}%`),
        eb('ino', 'in', inos),
      ]))
      .execute()
      .then((all) => Object.fromEntries(all.map((r) => [r.domainedPath, r] as const)), () => ({}))
    const inoMap = Object.fromEntries(Object.values(records).map((e) => [e.ino, e] as const))

    const result = entries.map((file) => {
      const domainedPath = getDomainedPath(file.path, context.root)
      const record = records[domainedPath] || inoMap[file.ino]

      delete records[domainedPath]
      if (!record || record.mtime < file.mtime) {
        return [file, undefined] as const
      }

      return [file, {
        ...record,
        mtime: file.mtime,
        domainedPath,
      }] as const
    })

    for (const r of Object.values(records)) {
      // to remove the record that is not in the file system
      onResourceRemove(join(context.root, r.domainedPath))
    }

    return result
  }

  async function revalidate() {
    const results = await getUpserts()

    const hits = results.map((jobs) => {
      if (!jobs[1]) {
        onResourceQueue({ filePath: jobs[0].path, file: jobs[0] })
        return undefined
      }
      return jobs
    }).filter((v): v is [File, ResourceSnapshotTable] => !!v)

    const resources = await context.db.selectFrom('resources')
      .selectAll()
      .select((eb) => [
        jsonArrayFrom(
          eb.selectFrom('icons').select(['icons.icon', 'icons.sha1']).whereRef('icons.sha1', '=', 'resources.sha1'),
        ).as('icons'),
      ])
      .where('sha1', 'in', hits.map(h => h[1].sha1))
      .execute().then((all) => toRecord(all, r => r.sha1))

    for (const [file, record] of hits) {
      const resource = resources[record.sha1]
      if (!resource) {
        onResourceQueue({ filePath: file.path, file, record })
        continue
      }
      if (basename(dir) === 'mods' && !resource.fabric && !resource.forge && !resource.quilt && !resource.neoforge && !file.isDirectory) {
        onResourceQueue({ filePath: file.path, file, record, metadata: resource })
        continue
      }
      onResourceEmit(file, record, { ...pickMetadata(resource), icons: resource.icons.map(i => i.icon) })
    }

    onResourcePostRevalidate(results.map(([f]) => f))
  }

  return revalidate
}

function createWorkerQueue(context: ResourceContext, domain: ResourceDomain,
  intercept: (func: () => Promise<void>) => Promise<void>,
  onResourceEmit: ResouceEmitFunc,
  parse: boolean,
) {
  const workerQueue = new WorkerQueue<ResourceWorkerQueuePayload>(async (job) => intercept(async () => {
    if (!job.file) {
      job.file = await getFile(job.filePath)
      if (!job.file) {
        throw new AnyError('ResourceFileNotFoundError', `Resource file ${job.filePath} not found`)
      }
    }

    if (job.record) {
      if (!isSnapshotValid(job.file, job.record)) {
        job.record = await takeSnapshot(job.file, context, parse)
      }
    }

    if (!job.record) {
      job.record = await takeSnapshot(job.file, context, parse)
    }

    const metadata = await getOrParseMetadata(job.file, job.record, domain, context, job, parse)

    if (parse && metadata) {
      context.eventBus.emit('resourceParsed', job.record.sha1, domain, metadata)
    }

    onResourceEmit(job.file, job.record, metadata ?? {})
  }), 16, {
    retryCount: 7,
    shouldRetry: (e) => isSystemError(e) && (e.code === 'EMFILE' || e.code === 'EBUSY'),
    retryAwait: (retry) => Math.random() * 2000 + 1000,
    isEqual: (a, b) => a.filePath === b.filePath,
    merge: (a, b) => {
      a.icons = [...new Set([...a.icons || [], ...b.icons || []])]
      a.uris = [...new Set([...a.uris || [], ...b.uris || []])]
      a.metadata = { ...a.metadata, ...b.metadata }
      a.record = b.record || a.record
      a.file = b.file || a.file
      return a
    },
  })
  return workerQueue
}

function createWatcher(
  path: string,
  logger: Logger,
  onResourceUpdate: (file: File) => void,
  onResourceRemove: (file: string) => void,
  revalidate: () => void,
) {
  const watcher = new FSWatcher({
    cwd: path,
    depth: 1,
    followSymlinks: true,
    alwaysStat: true,
    ignorePermissionErrors: true,
    ignoreInitial: true,
    ignored: (filePath) => {
      if (resolve(filePath) === path) return false
      return shouldIgnoreFile(filePath)
    },
  }).on('all', async (event, file, stat) => {
    if (!file) return

    const depth = file.split(sep).length
    if (depth > 1) return

    if (shouldIgnoreFile(file)) return
    if (file.endsWith('.txt')) return
    if (event === 'unlink') {
      onResourceRemove(join(path, file))
    } else if (event === 'add' || event === 'change') {
      if (!stat) {
        return
      }
      const fileObj: File = {
        path: join(path, file),
        fileName: basename(file),
        size: stat.size,
        mtime: stat.mtimeMs,
        atime: stat.atimeMs,
        ctime: stat.ctimeMs,
        ino: stat.ino,
        isDirectory: stat.isDirectory(),
      }
      onResourceUpdate(fileObj)
    } else if (event === 'unlinkDir' && file === path) {
      revalidate()
    }
  })

  watcher.add(path)

  return watcher
}

type ResouceEmitFunc = (file: File, record: ResourceSnapshotTable, metadata: ResourceMetadata & { icons?: string[] }) => void

export function watchResourcesDirectory(
  directory: string,
  domain: ResourceDomain,
  context: ResourceContext,
  processUpdate: (func: () => Promise<void>) => Promise<void>,
  onDispose: () => void,
  state = new ResourceState(),
) {
  const update = new AggregateExecutor<FileUpdateOperation, FileUpdateOperation[]>(v => v,
    (all) => state.filesUpdates(all),
    500)

  let disposed = false

  const onRemove = (file: string) => {
    if (disposed) return
    const fileRelativeName = getDomainedPath(file, context.root)
    context.db.deleteFrom('snapshots')
      .where('domainedPath', '=', fileRelativeName)
      .execute()
      .catch((e) => {
        context.logger.warn(e)
      })
    update.push([file, FileUpdateAction.Remove])
  }

  const onResourceEmit: ResouceEmitFunc = (file, record, metadata) => {
    const resource = generateResourceV3(file, record, metadata)
    if (!resource.path) {
      context.logger.error(new AnyError('ResourcePathError', 'Resource path is not available'))
      return
    }
    update.push([resource, FileUpdateAction.Upsert])
  }

  const workerQueue = createWorkerQueue(context, domain, processUpdate, onResourceEmit, true)
  const revalidate = createRevalidateFunction(directory, context, onRemove,
    (job) => {
      if (disposed) return
      workerQueue.push(job)
    }, (file, record, metadata) => {
      if (state.files.findIndex((r) => r.path === file.path) === -1) {
        onResourceEmit(file, record, metadata)
      }
    }, (files) => {
      const all = Object.fromEntries(files.map(f => [f.path, f]))
      for (const file of state.files) {
        if (!all[file.path]) {
          update.push([file.path, FileUpdateAction.Remove])
        }
      }
    })

  const watcher = createWatcher(directory, context.logger, async (file) => {
    if (disposed) return
    const record = await context.db.selectFrom('snapshots')
      .selectAll()
      .where((eb) => eb.or([
        eb('domainedPath', '=', getDomainedPath(file.path, context.root)),
        eb('ino', '=', file.ino),
      ]))
      .executeTakeFirst()

    workerQueue.push({ filePath: file.path, file, record })
  }, onRemove, revalidate)

  workerQueue.onerror = ({ filePath }, e) => {
    if ((e as any)?.code && ['EBUSY', 'ENOENT'].includes((e as any).code)) {
      // ignore the busy file
      return
    }
    if (!(e instanceof Error)) {
      e = Object.assign(new Error(), e)
    }
    context.logger.error(e)
  }

  const onResourceUpdate = (res: UpdateResourcePayload[]) => {
    if (res) {
      update.push([res, FileUpdateAction.Update])
    } else {
      context.logger.error(new AnyError('InstanceResourceUpdateError', 'Cannot update instance resource as it is empty'))
    }
  }
  context.eventBus.on('resourceUpdate', onResourceUpdate)

  function dispose() {
    disposed = true
    onDispose()
    watcher.close()
    workerQueue.dispose()
    context.eventBus.off('resourceUpdate', onResourceUpdate)
  }

  revalidate()

  function enqueue(job: ResourceWorkerQueuePayload) {
    if (!job.filePath.startsWith(directory)) {
      context.logger.error(new AnyError('ResourceEnqueueError', `Resource ${job.filePath} is not in the directory ${directory}`))
      return
    }
    workerQueue.push(job)
  }

  return {
    enqueue,
    state,
    dispose,
    revalidate,
  }
}

export function watchResourceSecondaryDirectory(
  directory: string,
  primaryDirectory: string,
  context: ResourceContext,
  onDispose: () => void,
) {
  async function isFileCached(file: File) {
    let record = await context.db.selectFrom('snapshots')
      .selectAll()
      .where('domainedPath', 'like', `${getDomainedPath(primaryDirectory, context.root)}%`)
      .where('ino', '=', file.ino)
      .executeTakeFirst()

    if (record) return true

    const snapshot = await takeSnapshot(file, context, true)

    record = await context.db.selectFrom('snapshots')
      .selectAll()
      .where('domainedPath', 'like', `${getDomainedPath(primaryDirectory, context.root)}%`)
      .where('sha1', '=', snapshot.sha1)
      .executeTakeFirst()

    if (record) {
      return true
    }

    return false
  }

  const revalidateDir = createRevalidateFunction(directory, context, () => { /* ignore remove */ }, async ({ filePath, file, record }) => {
    if (record) {
      const realPath = join(context.root, record.domainedPath)
      if (existsSync(realPath)) {
        return
      }
      // Remove dirty record
      context.db.deleteFrom('snapshots')
        .where('domainedPath', '=', record.domainedPath)
        .execute()
        .catch((e) => {
          context.logger.warn(e)
        })
    }
    // persist the file or directory to primary directory
    file = file || await getFile(filePath)
    if (file) {
      if (await isFileCached(file)) return
      persist(file)
    }
  }, () => { /* ignore */ }, () => { /* ignore */ })

  const watcher = new FSWatcher({
    cwd: directory,
    depth: 1,
    followSymlinks: true,
    ignorePermissionErrors: true,
    ignored: (path) => {
      if (resolve(path) === directory) return false
      return shouldIgnoreFile(path)
    },
  }).on('all', async (event, file) => {
    if (event === 'addDir' && file === '') return

    const depth = file.split(sep).length
    if (depth > 1) return

    const filePath = resolve(directory, file)
    if (event === 'unlink') {
      await context.db.deleteFrom('snapshots')
        .where('domainedPath', '=', getDomainedPath(filePath, context.root))
        .execute()
    } else if (event === 'change' || event === 'add' || event === 'addDir') {
      const file = await getFile(filePath)
      if (!file) return
      const isCached = await isFileCached(file).catch((e) => {
        if (isSystemError(e) && (e.code === 'ENOENT' || e.code === 'EBUSY')) {
          // ignore
          return false
        }
        context.logger.error(e)
        return false
      })
      if (isCached) return
      persist(file)
    }
  }).on('error', (e) => {
    context.logger.warn(new AnyError('ResourceWatchError', 'Error in resource watch', { cause: e }))
  }).on('ready', () => {
    context.logger.log('Resource watch ready')
  })

  watcher.add(directory)

  async function persist(file: File) {
    let target = join(primaryDirectory, file.fileName)
    // const onCopyDirectoryError = async (e: unknown) => {
    //   if (isSystemError(e)) {
    //     if (e.code === 'EEXIST') {
    //       if (await isHardLinked(file.path, target)) {
    //         return
    //       }
    //       target = join(primaryDirectory, `${file.fileName}.${randomBytes(4).toString('hex')}`)
    //       await ensureDir(target)
    //       copy(file.path, target).catch(onCopyDirectoryError)
    //       return
    //     }
    //   }
    //   context.logger.error(new AnyError('ResourceCopyError', `Fail to copy folder resource ${file.path} to ${target}`, { cause: e }))
    // }
    const inoMatched = await context.db.selectFrom('snapshots')
      .selectAll()
      .where('ino', '=', file.ino)
      .execute()
    if (inoMatched.length > 1) {
      return
    }
    if (!file.isDirectory) {
      const isInoMatched = await isHardLinked(file.path, target)
      if (isInoMatched) {
        return
      }
      linkOrCopyFile(file.path, target).catch(async (e) => {
        const extName = extname(target)
        const fileName = basename(target, extName)
        const to = join(dirname(target), fileName + `-${Date.now()}` + extName)
        await link(file.path, to).catch((e) => {
          if (isSystemError(e) && e.code === EEXIST_ERROR) {
            return
          }
          context.logger.error(new AnyError('ResourceCopyError', `Fail to copy file resource ${file.path} to ${target}`, { cause: e }))
        })
      })
    } else {
      // await ensureDir(target)
      // copy(file.path, target).catch(onCopyDirectoryError)
    }
  }

  const dispose = () => {
    onDispose()
    watcher?.close()
  }

  function revalidate() {
    return revalidateDir()
  }

  return {
    dispose,
    revalidate,
  }
}
