import { describe, it, expect, vi } from 'vitest'
import { ServerFSExporter, ServerExporter } from './server_exporter'
import { ServerOptions } from '@xmcl/core'
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
})
