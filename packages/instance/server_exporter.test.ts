import { describe, it, expect, vi } from 'vitest'
import { ServerFSExporter, ServerExporter } from './server_exporter'
import { ServerSSHExporter } from './server_exporter_ssh'
import { ServerOptions } from '@xmcl/core'
import { EventEmitter } from 'events'
import { join } from 'path'

class DummyExporter extends ServerExporter {
  copied: Array<{ from: string; to: string }> = []
  emitted: Array<{ path: string; content: string }> = []

  constructor(minecraftPath: string) {
    super(minecraftPath)
  }

  copyFile(from: string, to: string) {
    this.copied.push({ from, to })
  }
  emitFile(path: string, content: string) {
    this.emitted.push({ path, content })
  }
  async end(): Promise<void> {}
}

describe('server_exporter', () => {
  it('ServerFSExporter basic behavior', async () => {
    const exporter = new DummyExporter('/fake')

    const ops: ServerOptions = {
      classPath: ['libs/a.jar', 'libs/b.jar'],
      extraJVMArgs: [],
      serverExectuableJarPath: undefined,
      mainClass: 'net.minecraft.server.Main',
    } as any

    // create some files list
    const files = ['plugins/mod.jar', 'config/settings.conf']

    // call exportInstance
    await exporter.exportInstance('/server', ops as any, files)

    // it should have emitted server.bat and server.sh
    const emittedPaths = exporter.emitted.map((e) => e.path).sort()
    expect(emittedPaths).toContain('server.bat')
    expect(emittedPaths).toContain('server.sh')
  })

  it('waits for remote directories before writing files', async () => {
    const channel = Object.assign(new EventEmitter(), {
      resume: vi.fn(),
      stderr: { resume: vi.fn() },
    })
    const writeFile = vi.fn((_path, _content, callback) => callback())
    const ssh = {
      exec: vi.fn((_command, callback) => callback(undefined, channel)),
    }
    const sftp = {
      stat: vi.fn((_path, callback) => callback(new Error('missing'))),
      writeFile,
    }
    const exporter = new ServerSSHExporter('/data', '/remote', ssh as any, sftp as any)
    exporter.emitFile('nested/server.sh', '#!/bin/sh')

    const completed = exporter.end()
    await vi.waitFor(() => expect(ssh.exec).toHaveBeenCalledOnce())

    expect(channel.resume).toHaveBeenCalledOnce()
    expect(channel.stderr.resume).toHaveBeenCalledOnce()
    expect(writeFile).not.toHaveBeenCalled()
    channel.emit('close', 0)
    await completed
    expect(writeFile).toHaveBeenCalledOnce()
  })
})
