import { chmod, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it, vi } from 'vitest'
import { getJavaArch } from './detectJVMArch'

vi.mock('./JavaProxy.class', () => ({ default: Buffer.from('') }))

it.skipIf(process.platform === 'win32')('terminates a hung architecture probe and reports the timeout', async () => {
  const root = await mkdtemp(join(tmpdir(), 'xmcl-java-arch-'))
  const executable = join(root, 'java')
  try {
    await mkdir(join(root, 'data'))
    await writeFile(join(root, 'data', 'JavaProxy.class'), '')
    await writeFile(executable, '#!/usr/bin/env node\nsetInterval(() => {}, 1000)\n')
    await chmod(executable, 0o755)
    const warn = vi.fn()
    const service = { app: { appDataPath: join(root, 'data') }, warn }
    await expect(getJavaArch(service as never, executable, 100)).resolves.toBeUndefined()
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('architecture probe timed out'))
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
