import { generateArgumentsServer, MinecraftFolder } from '@xmcl/core'
import { InstanceFile, LaunchOptions } from '@xmcl/runtime-api'
import { copy, writeFile } from 'fs-extra'
import { join, relative } from 'path'
import { LauncherApp } from '~/app'
import { LaunchService } from '~/launch'
import { VersionService } from '~/version'

export abstract class InstanceExporter {
  constructor(protected app: LauncherApp, protected dataRoot: string) { }

  /**
   * @param from Absolute path
   * @param to Relative path to the output
   */
  abstract copyFile(from: string, to: string): void
  abstract emitFile(path: string, content: string): void
  abstract end(): Promise<void>

  onProgress: (chunk: number, progress: number, total: number) => void = () => { }

  async exportInstance(options: LaunchOptions, files: InstanceFile[]): Promise<void> {
    const launchService = await this.app.registry.get(LaunchService)
    const versionService = await this.app.registry.get(VersionService)

    const serverVersion = await versionService.resolveServerVersion(options.version)
    const ops = await launchService.generateServerOptions(options, serverVersion)
    ops.javaPath = 'java' // force use system java

    const cwd = options.gameDirectory
    ops.classPath = ops.classPath?.map(cp => relative(cwd, cp)) // force to use relative path

    const mc = MinecraftFolder.from(this.dataRoot)

    // copy all libs to the output folder
    serverVersion.libraries.map(lib => this.copyFile(mc.getLibraryByPath(lib.path), `libraries/${lib.path}`))

    // copy all files to the output folder
    files.map(file => this.copyFile(join(options.gameDirectory, 'server', file.path), file.path))

    // copy mc server jar
    const serverJarPath = mc.getVersionJar(serverVersion.minecraftVersion, 'server')
    this.copyFile(serverJarPath, relative(mc.root, serverJarPath))

    if (ops.serverExectuableJarPath) {
      // copy to the output folder
      this.copyFile(ops.serverExectuableJarPath, 'server.jar')
      ops.serverExectuableJarPath = 'server.jar'
    }

    const winArgs = generateArgumentsServer(ops, ';', '\\')
    const linuxArgs = generateArgumentsServer(ops, ':', '/')

    // write bat and sh
    const batContent = `@echo off\n${winArgs.join(' ')}`
    const shContent = `#!/bin/sh\n${linuxArgs.join(' ')}`
    this.emitFile('server.bat', batContent)
    this.emitFile('server.sh', shContent)

    await this.end()
  }
}

export class FSInstanceExporter extends InstanceExporter {
  constructor(app: LauncherApp, dataRoot: string, private outputFolder: string) {
    super(app, dataRoot)
  }

  #promises: Promise<void>[] = []

  copyFile(from: string, to: string) {
    this.#promises.push(copy(from, join(this.outputFolder, to)))
  }

  emitFile(path: string, content: string) {
    this.#promises.push(writeFile(join(this.outputFolder, path), content))
  }

  async end(): Promise<void> {
    await Promise.all(this.#promises)
  }
}


