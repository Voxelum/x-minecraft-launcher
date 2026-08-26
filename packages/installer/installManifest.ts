import { open, openEntryReadStream, readAllEntries, walkEntriesGenerator } from '@xmcl/unzip'
import { spawn } from 'child_process'
import { createReadStream, createWriteStream } from 'fs'
import { chmod, copyFile, link, mkdir, readFile, rename, rm, stat, symlink, unlink, writeFile } from 'fs/promises'
import { dirname, join, sep } from 'path'
import { pipeline } from 'stream/promises'
import { setTimeout as wait } from 'timers/promises'
import { extract } from 'tar-stream'
import { createGunzip } from 'zlib'
import { ZipFile as WriteableZipFile } from 'yazl'
import { checksum as checksumFile, waitProcess } from './utils'

export interface InstallFileChecksum {
  algorithm: string
  value: string
}

export interface InstallFile {
  path: string
  urls: string[]
  size?: number
  checksum?: InstallFileChecksum
  validator?: 'file' | 'zip' | 'json'
  /** Trust an existing file with the expected size, but still checksum newly downloaded content. */
  trustExistingSize?: boolean
  /** Replace the existing file before trusting any cached validation state. */
  replace?: boolean
  /** Last timestamp at which this exact file was known to be valid. */
  validatedAt?: number
}

export interface InstallOutput {
  path: string
  checksum?: InstallFileChecksum
  size?: number
  validator?: 'file' | 'zip' | 'json'
}

export interface JavaCommand {
  executable: string
  args: string[]
  cwd?: string
  env?: Record<string, string>
}

export interface InstallFilesTask {
  id: string
  type: 'files'
  files: InstallFile[]
  dependsOn?: string[]
}

export interface InstallJavaTask {
  id: string
  type: 'java'
  /** Strategies are tried in order. Commands inside one strategy run sequentially. */
  strategies: JavaCommand[][]
  outputs: InstallOutput[]
  dependsOn?: string[]
  metadata?: Record<string, string | number | boolean>
}

export type InstallMaterializeOperation =
  | { type: 'write'; path: string; content: string; encoding?: 'utf8' | 'base64' }
  | { type: 'ensure-directory'; path: string }
  | { type: 'chmod'; path: string; mode: number }
  | { type: 'copy'; source: string; path: string }
  | { type: 'link'; source: string; path: string }
  | { type: 'remove'; path: string }
  | { type: 'extract'; archive: string; entry: string; path: string }
  | { type: 'merge-zip'; archives: string[]; path: string; excludePrefixes?: string[] }
  | {
      type: 'extract-archive'
      archive: string
      path: string
      format: 'zip' | 'tar.gz'
      stripComponents?: number
    }

export interface InstallMaterializeTask {
  id: string
  type: 'materialize'
  operations: InstallMaterializeOperation[]
  outputs: InstallOutput[]
  dependsOn?: string[]
}

export type InstallTask = InstallFilesTask | InstallJavaTask | InstallMaterializeTask

/**
 * A domain-agnostic executable install manifest.
 *
 * Workflows may understand Minecraft, loaders, profiles, or asset indexes;
 * manifests and executors must not. A manifest only describes files, processes, and
 * deterministic filesystem materialization.
 */
export interface InstallManifest {
  schemaVersion: 1
  tasks: InstallTask[]
}

export interface InstallRuntime {
  stat(path: string): Promise<{ size: number; mtimeMs: number } | undefined>
  checksum(path: string, algorithm: string): Promise<string>
  download(files: InstallFile[]): Promise<void>
  java(command: JavaCommand): Promise<void>
  materialize(operations: InstallMaterializeOperation[]): Promise<{
    commit(): Promise<void>
    rollback(): Promise<void>
  }>
  remove(paths: string[]): Promise<void>
  validate(path: string, validator: NonNullable<InstallOutput['validator']>): Promise<boolean>
}

export type InstallEvent =
  | { type: 'task-start'; task: InstallTask; at: number }
  | { type: 'task-end'; task: InstallTask; at: number; duration: number; error?: unknown }
  | { type: 'file-retry'; task: InstallFilesTask; attempt: number; delay: number; pending: number; error?: unknown }
  | { type: 'java-strategy-start'; task: InstallJavaTask; strategy: number }
  | { type: 'java-strategy-failed'; task: InstallJavaTask; strategy: number; error: unknown }

export interface ExecuteInstallManifestOptions {
  attempts?: number
  retryBaseDelay?: number
  retryMaxDelay?: number
  random?: () => number
  wait?: (delay: number, signal?: AbortSignal) => Promise<void>
  signal?: AbortSignal
  now?: () => number
  onEvent?: (event: InstallEvent) => void
}

export interface InstallResult {
  timestamp: number
  duration: number
  timings: Array<{ task: string; type: InstallTask['type']; startedAt: number; duration: number }>
}

export type InstallPlanStep<T> =
  | { done: false; plan: InstallManifest }
  | { done: true; result: T }

export interface InstallWorkflow<T> {
  /**
   * Resolve the next executable stage from files produced by earlier stages.
   * This method may read checkpoints but must not download, spawn, or write.
   */
  next(): Promise<InstallPlanStep<T>>
}

export interface ExecuteInstallWorkflowOptions extends ExecuteInstallManifestOptions {
  maxStages?: number
}

export interface RunInstallWorkflowOptions {
  maxStages?: number
}

async function isFileValid(
  file: Pick<InstallFile, 'path' | 'size' | 'checksum' | 'validatedAt' | 'validator' | 'trustExistingSize' | 'replace'>,
  runtime: InstallRuntime,
  trustCachedValidation: boolean,
) {
  if (trustCachedValidation && file.replace) return false
  const fileStat = await runtime.stat(file.path)
  if (!fileStat) return false
  if (trustCachedValidation && file.validatedAt !== undefined && fileStat.mtimeMs <= file.validatedAt) {
    return true
  }
  if (trustCachedValidation && file.trustExistingSize && file.size !== undefined && fileStat.size === file.size) return true
  let valid: boolean
  if (file.checksum?.value) {
    valid = await runtime.checksum(file.path, file.checksum.algorithm).catch(() => '') === file.checksum.value
  } else if (file.size !== undefined && file.size >= 0) {
    valid = fileStat.size === file.size
  } else {
    valid = fileStat.size > 0
  }
  return valid && (!file.validator || await runtime.validate(file.path, file.validator))
}

async function isOutputValid(output: InstallOutput, runtime: InstallRuntime) {
  return isFileValid({ ...output, validatedAt: undefined }, runtime, false)
}

async function invalidOutputs(outputs: InstallOutput[], runtime: InstallRuntime) {
  const validity = await Promise.all(outputs.map((output) => isOutputValid(output, runtime)))
  return outputs.filter((_, index) => !validity[index])
}

async function executeFiles(
  task: InstallFilesTask,
  runtime: InstallRuntime,
  options: {
    attempts: number
    retryBaseDelay: number
    retryMaxDelay: number
    random: () => number
    wait: (delay: number, signal?: AbortSignal) => Promise<void>
    signal?: AbortSignal
    onRetry?: (attempt: number, delay: number, pending: number, error?: unknown) => void
  },
) {
  const unique = [...new Map(task.files.map((file) => [file.path, file])).values()]
  let pending = (await Promise.all(unique.map(async (file) => ({
    file,
    valid: await isFileValid(file, runtime, true),
  })))).filter(({ valid }) => !valid).map(({ file }) => file)
  let lastError: unknown

  for (let attempt = 0; attempt < options.attempts && pending.length > 0; attempt++) {
    options.signal?.throwIfAborted()
    try {
      await runtime.download(pending)
      lastError = undefined
    } catch (error) {
      lastError = error
    }
    const invalid = (await Promise.all(pending.map(async (file) => ({
      file,
      valid: await isFileValid({ ...file, validatedAt: undefined }, runtime, false),
    })))).filter(({ valid }) => !valid).map(({ file }) => file)
    await runtime.remove(invalid.map((file) => file.path))
    pending = invalid.map((file) => file.urls.length > 1
      ? { ...file, urls: [...file.urls.slice(1), file.urls[0]] }
      : file)
    if (pending.length > 0 && lastError && isTerminalInstallError(lastError)) throw lastError
    if (pending.length > 0 && attempt + 1 < options.attempts) {
      const ceiling = Math.min(options.retryMaxDelay, options.retryBaseDelay * 2 ** attempt)
      const delay = Math.round(ceiling * (0.75 + options.random() * 0.5))
      options.onRetry?.(attempt + 1, delay, pending.length, lastError)
      await options.wait(delay, options.signal)
    }
  }

  if (pending.length > 0) {
    throw lastError ?? new Error(`Cannot recover ${pending.length} install file(s): ${pending.map((file) => file.path).join(', ')}`)
  }
}

function isTerminalInstallError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  if (error instanceof AggregateError) return error.errors.some(isTerminalInstallError)
  const value = error as { name?: string; code?: string; cause?: unknown }
  if (value.name === 'AbortError') return true
  if (value.code && ['ABORT_ERR', 'EPERM', 'EACCES', 'ENOSPC', 'EROFS'].includes(value.code)) return true
  return value.cause ? isTerminalInstallError(value.cause) : false
}

async function executeJava(
  task: InstallJavaTask,
  runtime: InstallRuntime,
  onStrategyStart?: (strategy: number) => void,
  onStrategyFailed?: (strategy: number, error: unknown) => void,
) {
  if (task.outputs.length > 0 && (await invalidOutputs(task.outputs, runtime)).length === 0) return
  let lastError: unknown
  for (let strategyIndex = 0; strategyIndex < task.strategies.length; strategyIndex++) {
    const strategy = task.strategies[strategyIndex]
    onStrategyStart?.(strategyIndex)
    try {
      for (const command of strategy) await runtime.java(command)
      const invalid = await invalidOutputs(task.outputs, runtime)
      if (task.outputs.length === 0 || invalid.length === 0) return
      await runtime.remove(invalid.map((output) => output.path))
      lastError = new Error(`Java strategy produced ${invalid.length} invalid output(s): ${invalid.map((output) => output.path).join(', ')}`)
      onStrategyFailed?.(strategyIndex, lastError)
    } catch (error) {
      lastError = error
      onStrategyFailed?.(strategyIndex, error)
      const invalid = await invalidOutputs(task.outputs, runtime)
      await runtime.remove(invalid.map((output) => output.path))
    }
  }
  throw lastError ?? new Error(`No Java strategy produced valid outputs for ${task.id}`)
}

async function executeMaterialize(task: InstallMaterializeTask, runtime: InstallRuntime) {
  const transaction = await runtime.materialize(task.operations)
  try {
    const invalid = await invalidOutputs(task.outputs, runtime)
    if (invalid.length > 0) {
      throw new Error(`Materialize task produced ${invalid.length} invalid output(s): ${invalid.map((output) => output.path).join(', ')}`)
    }
    await transaction.commit()
  } catch (error) {
    await transaction.rollback()
    throw error
  }
}

export async function executeInstallManifest(
  plan: InstallManifest,
  runtime: InstallRuntime,
  options: ExecuteInstallManifestOptions = {},
): Promise<InstallResult> {
  if (plan.schemaVersion !== 1) throw new Error(`Unsupported install manifest schema: ${plan.schemaVersion}`)
  const now = options.now ?? Date.now
  const startedAt = now()
  const attempts = Math.max(1, options.attempts ?? 5)
  const retryBaseDelay = Math.max(0, options.retryBaseDelay ?? 500)
  const retryMaxDelay = Math.max(retryBaseDelay, options.retryMaxDelay ?? 4_000)
  const random = options.random ?? Math.random
  const waitForRetry = options.wait ?? ((delay, signal) => wait(delay, undefined, { signal }))
  const tasks = new Map(plan.tasks.map((task) => [task.id, task]))
  if (tasks.size !== plan.tasks.length) throw new Error('Install manifest contains duplicate task ids')
  const running = new Map<string, Promise<void>>()
  const visiting = new Set<string>()
  const timings: InstallResult['timings'] = []

  const execute = (id: string): Promise<void> => {
    const existed = running.get(id)
    if (existed) return existed
    const task = tasks.get(id)
    if (!task) return Promise.reject(new Error(`Unknown install task ${id}`))
    if (visiting.has(id)) return Promise.reject(new Error(`Install manifest dependency cycle at ${id}`))
    visiting.add(id)
    const dependencies = (task.dependsOn ?? []).map(execute)
    visiting.delete(id)
    const promise = Promise.all(dependencies).then(async () => {
      const taskStartedAt = now()
      options.onEvent?.({ type: 'task-start', task, at: taskStartedAt })
      try {
        if (task.type === 'files') await executeFiles(task, runtime, {
          attempts,
          retryBaseDelay,
          retryMaxDelay,
          random,
          wait: waitForRetry,
          signal: options.signal,
          onRetry: (attempt, delay, pending, error) => options.onEvent?.({
            type: 'file-retry',
            task,
            attempt,
            delay,
            pending,
            error,
          }),
        })
        else if (task.type === 'java') await executeJava(
          task,
          runtime,
          (strategy) => options.onEvent?.({ type: 'java-strategy-start', task, strategy }),
          (strategy, error) => options.onEvent?.({ type: 'java-strategy-failed', task, strategy, error }),
        )
        else await executeMaterialize(task, runtime)
        const endedAt = now()
        timings.push({ task: task.id, type: task.type, startedAt: taskStartedAt, duration: endedAt - taskStartedAt })
        options.onEvent?.({ type: 'task-end', task, at: endedAt, duration: endedAt - taskStartedAt })
      } catch (error) {
        const endedAt = now()
        options.onEvent?.({ type: 'task-end', task, at: endedAt, duration: endedAt - taskStartedAt, error })
        throw error
      }
    })
    running.set(id, promise)
    return promise
  }

  await Promise.all(plan.tasks.map((task) => execute(task.id)))
  const timestamp = now()
  return {
    timestamp,
    duration: timestamp - startedAt,
    timings: timings.sort((a, b) => a.startedAt - b.startedAt),
  }
}

export async function executeInstallWorkflow<T>(
  workflow: InstallWorkflow<T>,
  runtime: InstallRuntime,
  options: ExecuteInstallWorkflowOptions = {},
): Promise<T> {
  return runInstallWorkflow(
    workflow,
    (plan) => executeInstallManifest(plan, runtime, options).then(() => undefined),
    options,
  )
}

export async function runInstallWorkflow<T>(
  workflow: InstallWorkflow<T>,
  execute: (plan: InstallManifest, stage: number) => Promise<void>,
  options: RunInstallWorkflowOptions = {},
): Promise<T> {
  const maxStages = Math.max(1, options.maxStages ?? 32)
  for (let stage = 0; stage < maxStages; stage++) {
    const step = await workflow.next()
    if (step.done) return step.result
    await execute(step.plan, stage)
  }
  throw new Error(`Install workflow exceeded ${maxStages} stages`)
}

export interface NodeInstallRuntimeOptions {
  signal?: AbortSignal
  checksum?: (path: string, algorithm: string) => Promise<string>
  download?: (files: InstallFile[]) => Promise<void>
  runJava?: (command: JavaCommand) => Promise<void>
}

function resolveArchivePath(name: string, stripComponents: number) {
  if (name.startsWith('/') || /^[A-Za-z]:/.test(name)) return undefined
  const parts = name.replaceAll('\\', '/').split('/').filter(Boolean).slice(stripComponents)
  if (parts.length === 0 || parts.some((part) => part === '..')) return undefined
  return parts.join(sep)
}

async function extractZipArchive(
  archivePath: string,
  destination: string,
  stripComponents: number,
  signal?: AbortSignal,
) {
  const archive = await open(archivePath, { lazyEntries: true, autoClose: false })
  try {
    for await (const entry of walkEntriesGenerator(archive)) {
      signal?.throwIfAborted()
      const relative = resolveArchivePath(entry.fileName, stripComponents)
      if (!relative) continue
      const path = join(destination, relative)
      if (entry.fileName.endsWith('/')) {
        await mkdir(path, { recursive: true })
      } else {
        await mkdir(dirname(path), { recursive: true })
        await pipeline(await openEntryReadStream(archive, entry), createWriteStream(path))
        const mode = (entry.externalFileAttributes >>> 16) & 0xffff
        if (mode) await chmod(path, mode).catch(() => undefined)
      }
    }
  } finally {
    archive.close()
  }
}

async function extractTarGzArchive(
  archivePath: string,
  destination: string,
  stripComponents: number,
  signal?: AbortSignal,
) {
  const entries = extract()
  const pipe = pipeline(createReadStream(archivePath), createGunzip(), entries)
  try {
    for await (const entry of entries) {
      signal?.throwIfAborted()
      const relative = resolveArchivePath(entry.header.name, stripComponents)
      if (!relative) {
        entry.resume()
        continue
      }
      const path = join(destination, relative)
      if (entry.header.type === 'directory') {
        await mkdir(path, { recursive: true })
        entry.resume()
      } else if (entry.header.type === 'symlink' && entry.header.linkname) {
        await mkdir(dirname(path), { recursive: true })
        await symlink(entry.header.linkname, path).catch(() => undefined)
        entry.resume()
      } else if (entry.header.type === 'file') {
        await mkdir(dirname(path), { recursive: true })
        await pipeline(entry, createWriteStream(path))
        if (entry.header.mode) await chmod(path, entry.header.mode).catch(() => undefined)
      } else {
        entry.resume()
      }
    }
    await pipe
  } catch (error) {
    entries.destroy(error as Error)
    await pipe.catch(() => undefined)
    throw error
  }
}

async function mergeZipArchives(
  archivePaths: string[],
  destination: string,
  excludePrefixes: string[],
  signal?: AbortSignal,
) {
  const archives = [] as Array<Awaited<ReturnType<typeof open>>>
  try {
    const entries = new Map<string, { archive: Awaited<ReturnType<typeof open>>; entry: Awaited<ReturnType<typeof readAllEntries>>[number] }>()
    for (const archivePath of archivePaths) {
      signal?.throwIfAborted()
      const archive = await open(archivePath, { lazyEntries: true, autoClose: false })
      archives.push(archive)
      for (const entry of await readAllEntries(archive)) {
        if (entry.fileName.endsWith('/') || excludePrefixes.some((prefix) => entry.fileName.startsWith(prefix))) continue
        entries.set(entry.fileName, { archive, entry })
      }
    }

    const output = new WriteableZipFile()
    for (const [name, { archive, entry }] of entries) {
      signal?.throwIfAborted()
      output.addReadStream(await openEntryReadStream(archive, entry), name)
    }
    output.end()
    await pipeline(output.outputStream, createWriteStream(destination))
  } finally {
    for (const archive of archives) archive.close()
  }
}

export function createNodeInstallRuntime(options: NodeInstallRuntimeOptions = {}): InstallRuntime {
  return {
    stat: (path) => stat(path).then(({ size, mtimeMs }) => ({ size, mtimeMs }), () => undefined),
    checksum: options.checksum ?? checksumFile,
    download: options.download ?? (async (files) => {
      throw new Error(`No install download adapter for ${files.length} file(s)`)
    }),
    java: options.runJava ?? (async (command) => {
      const process = spawn(command.executable, command.args, {
        cwd: command.cwd,
        env: command.env ? { ...globalThis.process.env, ...command.env } : undefined,
        signal: options.signal,
      })
      await waitProcess(process)
    }),
    materialize: async (operations) => {
      const targets = new Set<string>()
      for (const operation of operations) {
        if (targets.has(operation.path)) throw new Error(`Duplicate materialize target ${operation.path}`)
        targets.add(operation.path)
      }
      const prepared: Array<{
        operation: InstallMaterializeOperation
        temporary?: string
        backup?: string
        replaced: boolean
        created?: boolean
      }> = []
      const rollback = async () => {
        for (const entry of [...prepared].reverse()) {
          if (entry.operation.type === 'ensure-directory') {
            if (entry.created) await rm(entry.operation.path, { recursive: true, force: true }).catch(() => undefined)
            continue
          }
          if (entry.replaced && entry.operation.type !== 'remove') {
            await rm(entry.operation.path, { recursive: true, force: true }).catch(() => undefined)
          }
          if (entry.backup) {
            await rename(entry.backup, entry.operation.path).catch(() => undefined)
          }
          if (entry.temporary) await rm(entry.temporary, { recursive: true, force: true }).catch(() => undefined)
        }
      }
      try {
        for (const operation of operations) {
          if (operation.type === 'ensure-directory') {
            const existed = await stat(operation.path).then(() => true, () => false)
            await mkdir(operation.path, { recursive: true })
            prepared.push({ operation, replaced: false, created: !existed })
            continue
          }
          if (operation.type === 'remove') {
            prepared.push({ operation, replaced: false })
            continue
          }
          await mkdir(dirname(operation.path), { recursive: true })
          const temporary = `${operation.path}.install-${process.pid}-${Math.random().toString(36).slice(2)}`
          prepared.push({ operation, temporary, replaced: false })
          if (operation.type === 'chmod') {
            await copyFile(operation.path, temporary)
            await chmod(temporary, operation.mode)
          } else if (operation.type === 'write') {
            await writeFile(
              temporary,
              operation.encoding === 'base64'
                ? Buffer.from(operation.content, 'base64')
                : operation.content,
            )
          } else if (operation.type === 'copy') {
            await copyFile(operation.source, temporary)
          } else if (operation.type === 'link') {
            await link(operation.source, temporary)
          } else if (operation.type === 'extract') {
            const archive = await open(operation.archive, { lazyEntries: true, autoClose: false })
            try {
              let extracted = false
              for await (const entry of walkEntriesGenerator(archive)) {
                if (entry.fileName !== operation.entry) continue
                await pipeline(await openEntryReadStream(archive, entry), createWriteStream(temporary))
                extracted = true
                break
              }
              if (!extracted) throw new Error(`Missing archive entry ${operation.entry}`)
            } finally {
              archive.close()
            }
          } else if (operation.type === 'merge-zip') {
            await mergeZipArchives(
              operation.archives,
              temporary,
              operation.excludePrefixes ?? [],
              options.signal,
            )
          } else {
            await mkdir(temporary, { recursive: true })
            if (operation.format === 'zip') {
              await extractZipArchive(
                operation.archive,
                temporary,
                operation.stripComponents ?? 0,
                options.signal,
              )
            } else {
              await extractTarGzArchive(
                operation.archive,
                temporary,
                operation.stripComponents ?? 0,
                options.signal,
              )
            }
          }
        }

        for (const entry of prepared) {
          if (entry.operation.type === 'ensure-directory') continue
          const backup = `${entry.operation.path}.backup-${process.pid}-${Math.random().toString(36).slice(2)}`
          if (await stat(entry.operation.path).then(() => true, () => false)) {
            await rename(entry.operation.path, backup)
            entry.backup = backup
          }
          if (entry.operation.type !== 'remove' && entry.temporary) {
            await rename(entry.temporary, entry.operation.path)
            entry.temporary = undefined
          }
          entry.replaced = true
        }
      } catch (error) {
        await rollback()
        throw error
      }

      return {
        commit: async () => {
          await Promise.all(prepared.map((entry) =>
            entry.backup ? rm(entry.backup, { recursive: true, force: true }).catch(() => undefined) : Promise.resolve(),
          ))
        },
        rollback,
      }
    },
    remove: async (paths) => {
      await Promise.all(paths.map((path) => unlink(path).catch(() => undefined)))
    },
    validate: async (path, validator) => {
      if (validator === 'file') return !!await stat(path).catch(() => undefined)
      if (validator === 'json') {
        return readFile(path, 'utf8').then((content) => {
          JSON.parse(content)
          return true
        }, () => false).catch(() => false)
      }
      let zip: Awaited<ReturnType<typeof open>> | undefined
      try {
        zip = await open(path, { lazyEntries: true, autoClose: false })
        for await (const entry of walkEntriesGenerator(zip)) {
          if (!entry.fileName.endsWith('/')) return true
        }
        return false
      } catch {
        return false
      } finally {
        zip?.close()
      }
    },
  }
}