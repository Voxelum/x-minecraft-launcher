import { ServerOptions, generateArgumentsServer } from '@xmcl/core'
import { copy, writeFile } from 'fs-extra'
import { delimiter, join, relative } from 'path'

/**
 * The abstract layer to export instance as a runnable server.
 *
 * This will emit the .sh and .bat files to start the server with all dependencies/mods needed.
 */
export abstract class ServerExporter {
  /**
   * @param from Absolute path
   * @param to Relative path to the output
   */
  abstract copyFile(from: string, to: string): void
  abstract emitFile(path: string, content: string): void
  abstract end(): Promise<void>

  onProgress: (chunk: number, progress: number, total: number) => void = () => {}

  /**
   *
   * @param minecraftPath The root folder of the Minecraft installation
   * @param context The context to resolve server version and generate server options
   */
  constructor(protected minecraftPath: string) {}

  async exportInstance(serverDir: string, options: ServerOptions, files: string[]): Promise<void> {
    const ops = { ...options }
    ops.javaPath = 'java' // force use system java

    if (ops.extraJVMArgs) {
      const paths =
        ops.extraJVMArgs.find((_, i, arr) => arr[i - 1] === '-p')?.split(delimiter) || []
      for (const p of paths) {
        this.copyFile(join(this.minecraftPath, p), p)
      }
      const legacyCp =
        ops.extraJVMArgs
          .find((v) => v.startsWith('-DlegacyClassPath'))
          ?.split('=')[1]
          ?.split(delimiter) || []
      for (const p of legacyCp) {
        this.copyFile(join(this.minecraftPath, p), p)
      }
    }

    ops.classPath = ops.classPath?.map((cp) => relative(serverDir, cp)) // force to use relative path

    for (const lib of ops.classPath || []) {
      this.copyFile(join(serverDir, lib), lib)
    }

    // copy all files to the output folder
    for (const file of files) {
      this.copyFile(join(serverDir, file), file)
    }

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

/**
 * The implementation of `ServerFSExporter` which export the server to a folder in the local filesystem.
 */
export class ServerFSExporter extends ServerExporter {
  #promises: Promise<void>[] = []

  constructor(
    dataRoot: string,
    protected outputFolder: string,
  ) {
    super(dataRoot)
  }

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
