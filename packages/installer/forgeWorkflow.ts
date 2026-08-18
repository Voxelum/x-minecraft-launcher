import { LibraryInfo, MinecraftFolder, Version } from '@xmcl/core'
import { open, readEntry } from '@xmcl/unzip'
import {
  isForgeInstallerEntries,
  isLegacyForgeInstallerEntries,
  resolveForgeInstallerMaterialization,
  resolveLegacyForgeInstallerMaterialization,
  resolveLegacyForgeUniversalMaterialization,
  walkForgeInstallerEntries,
  type InstallForgeOptions,
} from './forge'
import type {
  InstallFile,
  InstallMaterializeTask,
  InstallWorkflow,
  InstallTask,
} from './installManifest'
import { resolveLibraryInstallFiles } from './libraries'
import {
  resolvePostProcessJavaTask,
  resolveProcessors,
  type InstallProfile,
  type PostProcessor,
} from './profile'

export interface ForgeProcessorResolution {
  handled: boolean
  files?: InstallFile[]
}

export interface ModernForgeInstallWorkflowOptions {
  id: string
  minecraft: MinecraftFolder
  minecraftVersion: string
  installer: InstallFile
  artifactVersion: string
  java: string
  installOptions: InstallForgeOptions
  side?: 'client' | 'server'
  batchLauncher?: {
    path: string
    content: string
    encoding?: 'utf8' | 'base64'
    javaArgs?: string[]
    classpath?: string
    cwd?: string
  }
  postprocessMetadata?: Record<string, string | number | boolean>
  resolveProcessor?: (processor: PostProcessor) => Promise<ForgeProcessorResolution>
}

export interface ModernForgeInstallResult {
  version: string
  profile: InstallProfile
}

export interface ProfileInstallWorkflowOptions {
  id: string
  profile: InstallProfile
  minecraft: MinecraftFolder
  java: string
  installOptions: InstallForgeOptions
  side?: 'client' | 'server'
  batchLauncher?: ModernForgeInstallWorkflowOptions['batchLauncher']
  postprocessMetadata?: Record<string, string | number | boolean>
  resolveProcessor?: ModernForgeInstallWorkflowOptions['resolveProcessor']
}

export function createProfileInstallWorkflow(
  options: ProfileInstallWorkflowOptions,
): InstallWorkflow<string> {
  let stage = 0
  let processors: PostProcessor[] = []

  return {
    async next() {
      if (stage === 0) {
        const resolved = resolveProcessors(options.side ?? 'client', options.profile, options.minecraft)
        processors = []
        const files = resolveLibraryInstallFiles(
          Version.resolveLibraries(options.profile.libraries),
          options.minecraft,
          options.installOptions,
        )
        for (const processor of resolved) {
          const resolution = await options.resolveProcessor?.(processor)
          if (resolution?.files) files.push(...resolution.files)
          if (!resolution?.handled) processors.push(processor)
        }
        stage += 1
        return {
          done: false,
          plan: {
            schemaVersion: 1,
            tasks: [{ id: `${options.id}:inputs`, type: 'files', files }],
          },
        }
      }

      if (stage === 1) {
        stage += 1
        if (processors.length === 0) return { done: false, plan: { schemaVersion: 1, tasks: [] } }
        const tasks: InstallTask[] = []
        if (options.batchLauncher) {
          tasks.push({
            id: `${options.id}:batch-launcher`,
            type: 'materialize',
            operations: [{
              type: 'write',
              path: options.batchLauncher.path,
              content: options.batchLauncher.content,
              encoding: options.batchLauncher.encoding,
            }],
            outputs: [{ path: options.batchLauncher.path, validator: 'file' }],
          })
        }
        tasks.push(await resolvePostProcessJavaTask({
          id: `${options.id}:processors`,
          processors,
          minecraft: options.minecraft,
          java: options.java,
          javaArgs: options.batchLauncher?.javaArgs,
          batch: options.batchLauncher ? {
            classpath: options.batchLauncher.classpath ?? options.minecraft.root,
            cwd: options.batchLauncher.cwd ?? options.minecraft.root,
            javaArgs: options.batchLauncher.javaArgs,
          } : undefined,
          dependsOn: options.batchLauncher ? [`${options.id}:batch-launcher`] : undefined,
          metadata: options.postprocessMetadata,
        }))
        return { done: false, plan: { schemaVersion: 1, tasks } }
      }

      if (stage === 2) {
        stage += 1
        const parsed = await Version.parse(options.minecraft, options.profile.version)
        const tasks: InstallTask[] = [{
          id: `${options.id}:final-files`,
          type: 'files',
          files: resolveLibraryInstallFiles(parsed.libraries, options.minecraft, options.installOptions),
        }]
        if (options.batchLauncher) {
          tasks.push({
            id: `${options.id}:cleanup`,
            type: 'materialize',
            operations: [{ type: 'remove', path: options.batchLauncher.path }],
            outputs: [],
          })
        }
        return { done: false, plan: { schemaVersion: 1, tasks } }
      }

      return { done: true, result: options.profile.version }
    },
  }
}

export function createModernForgeInstallWorkflow(
  options: ModernForgeInstallWorkflowOptions,
): InstallWorkflow<ModernForgeInstallResult> {
  let stage = 0
  let profile: InstallProfile | undefined
  let version = ''
  let processors: PostProcessor[] = []
  let inputFiles: InstallFile[] = []
  let legacyInstaller = false
  let batchLauncherMaterialized = false

  return {
    async next() {
      if (stage === 0) {
        stage += 1
        return {
          done: false,
          plan: {
            schemaVersion: 1,
            tasks: [{ id: `${options.id}:installer`, type: 'files', files: [options.installer] }],
          },
        }
      }

      if (stage === 1) {
        const zip = await open(options.installer.path, { lazyEntries: true, autoClose: false })
        try {
          const entries = await walkForgeInstallerEntries(zip, options.artifactVersion)
          if (!entries.installProfileJson) throw new Error(`Missing install_profile.json: ${options.installer.path}`)
          const rawProfile: InstallProfile = await readEntry(zip, entries.installProfileJson)
            .then((content) => JSON.parse(content.toString()))
          let materialization: {
            task: InstallMaterializeTask
            profile: InstallProfile
            version: string
          } | undefined
          if (isForgeInstallerEntries(entries)) {
            materialization = await resolveForgeInstallerMaterialization(
              zip,
              entries,
              rawProfile,
              options.minecraft,
              options.installer.path,
              options.installOptions,
            )
          } else if (isLegacyForgeInstallerEntries(entries)) {
            legacyInstaller = true
            materialization = resolveLegacyForgeInstallerMaterialization(
              entries,
              rawProfile,
              options.minecraft,
              options.installer.path,
              options.installOptions,
            )
          }
          if (!materialization) throw new Error(`Unsupported Forge installer layout: ${options.installer.path}`)
          profile = materialization.profile
          version = materialization.version
          stage += 1
          return {
            done: false,
            plan: { schemaVersion: 1, tasks: [materialization.task] },
          }
        } finally {
          zip.close()
        }
      }

      if (!profile) throw new Error('Forge install workflow profile is unavailable')
  if (legacyInstaller && stage < 4) stage = 4
      if (stage === 2) {
        const resolved = resolveProcessors(options.side ?? 'client', profile, options.minecraft)
        processors = []
        inputFiles = resolveLibraryInstallFiles(
          Version.resolveLibraries(profile.libraries),
          options.minecraft,
          options.installOptions,
        )
        for (const processor of resolved) {
          const resolution = await options.resolveProcessor?.(processor)
          if (resolution?.files) inputFiles.push(...resolution.files)
          if (!resolution?.handled) processors.push(processor)
        }
        stage += 1
        return {
          done: false,
          plan: {
            schemaVersion: 1,
            tasks: [{ id: `${options.id}:inputs`, type: 'files', files: inputFiles }],
          },
        }
      }

      if (stage === 3) {
        stage += 1
        if (processors.length === 0) {
          return { done: false, plan: { schemaVersion: 1, tasks: [] } }
        }
        const tasks: Array<InstallMaterializeTask | Awaited<ReturnType<typeof resolvePostProcessJavaTask>>> = []
        if (options.batchLauncher) {
          batchLauncherMaterialized = true
          tasks.push({
            id: `${options.id}:batch-launcher`,
            type: 'materialize',
            operations: [{
              type: 'write',
              path: options.batchLauncher.path,
              content: options.batchLauncher.content,
              encoding: options.batchLauncher.encoding,
            }],
            outputs: [{ path: options.batchLauncher.path, validator: 'file' }],
          })
        }
        tasks.push(await resolvePostProcessJavaTask({
          id: `${options.id}:processors`,
          processors,
          minecraft: options.minecraft,
          java: options.java,
          javaArgs: options.batchLauncher?.javaArgs,
          batch: options.batchLauncher ? {
            classpath: options.batchLauncher.classpath ?? options.minecraft.root,
            cwd: options.batchLauncher.cwd ?? options.minecraft.root,
            javaArgs: options.batchLauncher.javaArgs,
          } : undefined,
          dependsOn: options.batchLauncher ? [`${options.id}:batch-launcher`] : undefined,
          metadata: options.postprocessMetadata,
        }))
        return { done: false, plan: { schemaVersion: 1, tasks } }
      }

      if (stage === 4) {
        stage += 1
        const parsed = await Version.parse(options.minecraft, version)
        const files = resolveLibraryInstallFiles(
          parsed.libraries,
          options.minecraft,
          options.installOptions,
        )
        const tasks: InstallTask[] = [{ id: `${options.id}:final-files`, type: 'files', files }]
        if (batchLauncherMaterialized && options.batchLauncher) {
          tasks.push({
            id: `${options.id}:cleanup`,
            type: 'materialize' as const,
            operations: [{ type: 'remove' as const, path: options.batchLauncher.path }],
            outputs: [],
          })
        }
        return { done: false, plan: { schemaVersion: 1, tasks } }
      }

      return { done: true, result: { version, profile } }
    },
  }
}

export interface LegacyForgeInstallWorkflowOptions {
  id: string
  minecraft: MinecraftFolder
  minecraftVersion: string
  artifactVersion: string
  universal: InstallFile
  installOptions: InstallForgeOptions
}

export function createLegacyForgeInstallWorkflow(
  options: LegacyForgeInstallWorkflowOptions,
): InstallWorkflow<string> {
  let stage = 0
  let version = ''
  return {
    async next() {
      if (stage === 0) {
        stage += 1
        return {
          done: false,
          plan: {
            schemaVersion: 1,
            tasks: [{ id: `${options.id}:universal`, type: 'files', files: [options.universal] }],
          },
        }
      }
      if (stage === 1) {
        stage += 1
        const materialization = resolveLegacyForgeUniversalMaterialization(
          options.universal.path,
          options.minecraft,
          options.artifactVersion,
          options.minecraftVersion,
        )
        version = materialization.version
        return { done: false, plan: { schemaVersion: 1, tasks: [materialization.task] } }
      }
      if (stage === 2) {
        stage += 1
        const parsed = await Version.parse(options.minecraft, version)
        return {
          done: false,
          plan: {
            schemaVersion: 1,
            tasks: [{
              id: `${options.id}:final-files`,
              type: 'files',
              files: resolveLibraryInstallFiles(parsed.libraries, options.minecraft, options.installOptions),
            }],
          },
        }
      }
      return { done: true, result: version }
    },
  }
}