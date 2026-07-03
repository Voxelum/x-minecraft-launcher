import { AggregateExecutor, AnyError, WorkerQueue, isSystemError } from '@xmcl/utils'
import { FSWatcher } from 'chokidar'
import { basename, join, resolve, sep } from 'path'
import { File } from '../File'
import { ResourceContext } from '../ResourceContext'
import { ResourceDomain } from '../ResourceDomain'
import { ResourceType } from '../ResourceType'
import { ResourceMetadata } from '../ResourceMetadata'
import { ResourceWorkerQueuePayload } from '../ResourceWorkerQueuePayload'
import { ResourceAction, ResourceActionTuple, ResourceErrorAction, ResourceErrorActionTuple, UpdateResourcePayload } from '../ResourcesState'
import { ResourceSnapshotTable } from '../schema'
import { generateResourceV3, pickMetadata } from './generateResource'
import { getFile, getFiles } from './getFile'
import { getOrParseMetadata } from './getOrParseMetadata'
import { shouldIgnoreFile } from './shouldIgnoreFile'
import { jsonArrayFrom } from './sqlHelper'
import { getDomainedPath, isSnapshotValid, takeSnapshot } from './takeSnapshot'

function createRevalidateFunction(
  dir: string,
  domain: ResourceDomain,
  context: ResourceContext,
  onResourceRemove: (path: string) => void,
  onResourceQueue: (job: ResourceWorkerQueuePayload) => void,
  onResourceTouched: ResouceEmitFunc,
  onResourcePostRevalidate: (files: File[]) => void,
  onResourceKnownBroken: (filePath: string, code: string) => void,
) {
  async function getFilesStatus() {
    const entries = await getFiles(dir, domain).catch((e) => {
      if (e.code === 'ENOENT') {
        return []
      }
      throw e
    })
    const inos = entries.map((e) => e.ino)
    const records: Record<string, ResourceSnapshotTable> = await context.db
      .selectFrom('snapshots')
      .selectAll()
      .where((eb) => eb.or([eb('domainedPath', 'like', `${dir}%`), eb('ino', 'in', inos)]))
      .execute()
      .then(
        (all) => Object.fromEntries(all.map((r) => [r.domainedPath, r] as const)),
        () => ({}),
      )
    const inoMap = Object.fromEntries(Object.values(records).map((e) => [e.ino, e] as const))

    const result = entries.map((file) => {
      const domainedPath = getDomainedPath(file.path, context.root)
      const record = records[domainedPath] || inoMap[file.ino]

      delete records[domainedPath]
      if (!record || record.mtime < file.mtime) {
        return [file, undefined] as const
      }

      return [
        file,
        {
          ...record,
          mtime: file.mtime,
          domainedPath,
        },
      ] as const
    })

    for (const r of Object.values(records)) {
      // to remove the record that is not in the file system
      onResourceRemove(join(context.root, r.domainedPath))
    }

    return result
  }

  async function revalidate() {
    const touchedFiles = await getFilesStatus()

    // files has snapshots
    const existed = touchedFiles
      .map((jobs) => {
        if (!jobs[1]) {
          onResourceQueue({ filePath: jobs[0].path, file: jobs[0] })
          return undefined
        }
        // The file is already known to be unparseable and its on-disk
        // bytes haven't changed (mtime+ino still match the snapshot).
        // Re-running the parser would just re-throw the same exception
        // and re-toast the user — surface the cached error instead and
        // drop the file from the worker queue. See issue #1453.
        if (jobs[1].parseError) {
          onResourceKnownBroken(jobs[0].path, jobs[1].parseError)
          return undefined
        }
        return jobs
      })
      .filter((v): v is [File, ResourceSnapshotTable] => !!v)

    const resources = await context.db
      .selectFrom('resources')
      .selectAll()
      .select((eb) => [
        jsonArrayFrom(
          eb
            .selectFrom('icons')
            .select(['icons.icon', 'icons.sha1'])
            .whereRef('icons.sha1', '=', 'resources.sha1'),
        ).as('icons'),
      ])
      .where(
        'sha1',
        'in',
        existed.map((h) => h[1].sha1),
      )
      .execute()
      .then((all) => Object.fromEntries(all.map((a) => [a.sha1, a])))

    for (const [file, record] of existed) {
      const resource = resources[record.sha1]
      if (!resource) {
        onResourceQueue({ filePath: file.path, file, record })
        continue
      }
      if (
        basename(dir) === 'mods' &&
        !resource.fabric &&
        !resource.forge &&
        !resource.quilt &&
        !resource.neoforge &&
        !file.isDirectory
      ) {
        onResourceQueue({ filePath: file.path, file, record, metadata: resource })
        continue
      }
      onResourceTouched(file, record, {
        ...pickMetadata(resource),
        icons: resource.icons.map((i) => i.icon),
      })
    }

    onResourcePostRevalidate(touchedFiles.map(([f]) => f))
  }

  return revalidate
}
function createWorkerQueue(
  context: ResourceContext,
  domain: ResourceDomain,
  intercept: (func: () => Promise<void>) => Promise<void>,
  onResourceEmit: ResouceEmitFunc,
  parse: boolean,
) {
  const workerQueue = new WorkerQueue<ResourceWorkerQueuePayload>(
    async (job) =>
      intercept(async () => {
        if (!job.file) {
          job.file = await getFile(job.filePath)
          if (!job.file) {
            throw new AnyError(
              'ResourceFileNotFoundError',
              `Resource file ${job.filePath} not found`,
            )
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
          context.event.emit('resourceParsed', job.record.sha1, domain, metadata)
        }

        onResourceEmit(job.file, job.record, metadata ?? {})
      }),
    16,
    {
      retryCount: 7,
      shouldRetry: (e) => isSystemError(e) && (e.code === 'EMFILE' || e.code === 'EBUSY'),
      retryAwait: (retry) => Math.random() * 2000 + 1000,
      isEqual: (a, b) => a.filePath === b.filePath,
      merge: (a, b) => {
        a.icons = [...new Set([...(a.icons || []), ...(b.icons || [])])]
        a.uris = [...new Set([...(a.uris || []), ...(b.uris || [])])]
        a.metadata = { ...a.metadata, ...b.metadata }
        a.record = b.record || a.record
        a.file = b.file || a.file
        return a
      },
    },
  )
  return workerQueue
}

function createWatcher(
  path: string,
  domain: ResourceDomain,
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
      return shouldIgnoreFile(filePath, domain)
    },
    // @ts-ignore
  }).on('all', async (event, file, stat) => {
    if (!file) return

    const depth = file.split(sep).length
    if (depth > 1) return

    if (shouldIgnoreFile(file, domain)) return
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

type ResouceEmitFunc = (
  file: File,
  record: ResourceSnapshotTable,
  metadata: ResourceMetadata & { icons?: string[] },
) => void

export interface WorkerQueueFactory {
  (
    handler: (value: ResourceWorkerQueuePayload) => Promise<void>,
  ): WorkerQueue<ResourceWorkerQueuePayload>
}

export interface WatchResourceDirectoryOptions {
  directory: string
  domain: ResourceDomain
  context: ResourceContext
  processUpdate: (func: () => Promise<void>) => Promise<void>
  onDispose: () => void
}

export function watchResourcesDirectory({
  directory,
  domain,
  context,
  processUpdate,
  onDispose,
}: WatchResourceDirectoryOptions) {
  let disposed = false
  const update = new AggregateExecutor<ResourceActionTuple, ResourceActionTuple[]>(
    (v) => v,
    (all) => state.filesUpdates(all),
    500,
  )
  const errorUpdate = new AggregateExecutor<ResourceErrorActionTuple, ResourceErrorActionTuple[]>(
    (v) => v,
    (all) => state.errorsUpdates(all),
    500,
  )

  const state = context.createResourceState()

  const onRemove = (file: string) => {
    if (disposed) return
    const fileRelativeName = getDomainedPath(file, context.root)
    context.db
      .deleteFrom('snapshots')
      .where('domainedPath', '=', fileRelativeName)
      .execute()
      // Blueprints are content-addressed but rarely shared between instances,
      // and their cached metadata (palette + voxels) is large. Once the
      // snapshot is gone, drop any blueprint resource rows that no longer have
      // a snapshot so the cache doesn't accumulate dead rows.
      .then(() => domain === ResourceDomain.Blueprints ? cascadeDeleteOrphanBlueprints(context) : undefined)
      .catch((e) => {})

    update.push([file, ResourceAction.Remove])
    errorUpdate.push([file, ResourceErrorAction.Remove])
  }

  const onResourceEmit: ResouceEmitFunc = (file, record, metadata) => {
    const resource = generateResourceV3(file, record, metadata)
    if (!resource.path) {
      context.onError(new AnyError('ResourcePathError', 'Resource path is not available'))
      return
    }
    // The file parsed successfully — clear any prior parse-error entry so
    // the UI stops complaining about it (covers the "user replaced the
    // broken jar with a working one" flow).
    errorUpdate.push([resource.path, ResourceErrorAction.Remove])
    update.push([resource, ResourceAction.Upsert])
  }

  const onResourceQueue = (job: ResourceWorkerQueuePayload) => {
    if (disposed) return
    workerQueue.push(job)
  }

  // Surface a previously recorded parse error for a file whose bytes
  // have not changed since the worker last failed on it. Deduped
  // against `state.errors` so the renderer's toast notifier (which
  // fires on every `Upsert`) only blares once per broken file per
  // session, instead of every revalidate / focus / reconnect.
  // See issue #1453.
  const onResourceKnownBroken = (filePath: string, code: string) => {
    if (disposed) return
    const existing = state.errors.find((e) => e.path === filePath)
    if (existing && existing.code === code) return
    errorUpdate.push([{ path: filePath, code }, ResourceErrorAction.Upsert])
  }

  const onResourcePostRevalidate = (files: File[]) => {
    const all = Object.fromEntries(files.map((f) => [f.path, f]))
    for (const file of state.files) {
      if (!all[file.path]) {
        update.push([file.path, ResourceAction.Remove])
      }
    }
  }

  const workerQueue = createWorkerQueue(context, domain, processUpdate, onResourceEmit, true)
  const revalidate = createRevalidateFunction(
    directory,
    domain,
    context,
    onRemove,
    onResourceQueue,
    (f, r, m) => {
      if (state.files.find((ff) => ff.path === f.path)) {
        return
      }
      onResourceEmit(f, r, m)
    },
    onResourcePostRevalidate,
    onResourceKnownBroken,
  )

  const watcher = createWatcher(
    directory,
    domain,
    async (file) => {
      if (disposed) return
      const record = await context.db
        .selectFrom('snapshots')
        .selectAll()
        .where((eb) =>
          eb.or([
            eb('domainedPath', '=', getDomainedPath(file.path, context.root)),
            eb('ino', '=', file.ino),
          ]),
        )
        .executeTakeFirst()

      workerQueue.push({ filePath: file.path, file, record })
    },
    onRemove,
    revalidate,
  )

  workerQueue.onerror = ({ filePath }, e) => {
    if (disposed) return
    if ((e as any)?.code && ['EBUSY', 'ENOENT'].includes((e as any).code)) {
      // ignore the busy file
      return
    }
    if (!(e instanceof Error)) {
      e = Object.assign(new Error(), e)
    }
    // If the parse failed with a known broken-file signature (the
    // upstream `getOrParseMetadata.handleParseError` routes those through
    // `context.throwException` → `ParseException`), surface it on the
    // state so the UI can toast the user the path of the offending file.
    // The cause is the user's file (truncated download, paid pack with
    // exotic ZIP layout, permission denied, etc.), not a defect in the
    // launcher, so we deliberately skip `context.onError` to avoid
    // re-logging the same stack on every revalidate. Other errors
    // (logic bugs, IO surprises) still go to `onError` for telemetry.
    const ex = (e as any)?.exception
    if (ex && ex.type === 'parseResourceException' && typeof ex.code === 'string') {
      // Reuse the deduped path so the renderer doesn't get a fresh
      // Upsert (and toast) for a file that's already marked broken with
      // the same code. See issue #1453.
      onResourceKnownBroken(filePath, ex.code)
      return
    }
    context.onError(e)
  }

  const onResourceUpdate = (res: UpdateResourcePayload[]) => {
    if (res) {
      update.push([res, ResourceAction.BatchUpdate])
    } else {
      context.onError(
        new AnyError(
          'InstanceResourceUpdateError',
          'Cannot update instance resource as it is empty',
        ),
      )
    }
  }

  context.event.on('resourceUpdate', onResourceUpdate)
  function dispose() {
    disposed = true
    onDispose()
    watcher.close()
    workerQueue.dispose()
    context.event.off('resourceUpdate', onResourceUpdate)
  }

  revalidate()

  function enqueue(job: ResourceWorkerQueuePayload) {
    if (!job.filePath.startsWith(directory)) {
      context.onError(
        new AnyError(
          'ResourceEnqueueError',
          `Resource ${job.filePath} is not in the directory ${directory}`,
        ),
      )
      return
    }
    workerQueue.push(job)
  }

  return {
    enqueue,
    dispose,
    revalidate,
    state,
  }
}

/**
 * Delete blueprint resource metadata (and its uris/icons) whose sha1 no longer
 * has any snapshot referencing it. Keeps the content-addressed cache from
 * accumulating heavy palette/voxel rows after blueprint files are removed.
 */
async function cascadeDeleteOrphanBlueprints(context: ResourceContext) {
  const orphans = await context.db
    .selectFrom('resources')
    .select('sha1')
    .where(ResourceType.Blueprint, 'is not', null)
    .where((eb) => eb('sha1', 'not in', eb.selectFrom('snapshots').select('sha1')))
    .execute()
  if (orphans.length === 0) return
  const hashes = orphans.map((o) => o.sha1)
  await context.db.deleteFrom('resources').where('sha1', 'in', hashes).execute()
  await context.db.deleteFrom('uris').where('sha1', 'in', hashes).execute()
  await context.db.deleteFrom('icons').where('sha1', 'in', hashes).execute()
}

