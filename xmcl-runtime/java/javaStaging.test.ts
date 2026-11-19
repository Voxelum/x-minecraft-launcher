import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { mkdtemp, mkdir, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import { cleanupAbandonedJavaStaging } from './javaStaging'

it('removes only staging directories owned by an exited process', async () => {
  const root = await mkdtemp(join(tmpdir(), 'xmcl-stale-java-'))
  const child = spawn(process.execPath, ['-e', ''])
  const pid = child.pid
  await once(child, 'exit')
  if (!pid) throw new Error('Failed to start test process')
  const dead = `.xmcl-java-${pid}-Ab1234`
  const active = `.xmcl-java-${process.pid}-Ab1234`
  const legacy = '.xmcl-java-Ab1234'
  try {
    await Promise.all([dead, active, legacy, 'ordinary'].map(name => mkdir(join(root, name))))
    await cleanupAbandonedJavaStaging(root)
    expect((await readdir(root)).sort()).toEqual([active, legacy, 'ordinary'].sort())
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
