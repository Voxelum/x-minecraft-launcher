import { mkdtemp, mkdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import { matchesJavaRuntimeIdentity, getOrCreateJavaRuntimeIdentity, readJavaReplacementJournal, removeJavaReplacementJournal, writeJavaReplacementJournal } from './javaReplacementJournal'

it('only accepts the identified original runtime, while allowing an already removed runtime', async () => {
  const root = await mkdtemp(join(tmpdir(), 'xmcl-java-identity-'))
  const directory = join(root, 'old')
  try {
    await mkdir(directory)
    const identity = await getOrCreateJavaRuntimeIdentity(directory)
    expect(await getOrCreateJavaRuntimeIdentity(directory)).toBe(identity)
    await expect(matchesJavaRuntimeIdentity(directory, identity)).resolves.toBe(true)
    await expect(matchesJavaRuntimeIdentity(directory)).resolves.toBe(false)
    await rm(directory, { recursive: true })
    await expect(matchesJavaRuntimeIdentity(directory, identity)).resolves.toBe(true)
    await mkdir(directory)
    await expect(matchesJavaRuntimeIdentity(directory, identity)).resolves.toBe(false)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

it('rejects journals that point outside managed Java or at the replacement itself', async () => {
  const root = await mkdtemp(join(tmpdir(), 'xmcl-java-marker-'))
  const directory = join(root, 'new')
  const record = {
    path: join(directory, 'bin', 'java'), version: '17', majorVersion: 17,
    valid: true, isInternal: true, installVendor: 'net.adoptium.java',
    replacesJava: join(root, 'old', 'bin', 'java'), replacementRuntime: join(root, 'old'),
  }
  try {
    await mkdir(directory)
    await writeJavaReplacementJournal(directory, record)
    expect(await readJavaReplacementJournal(directory, root, false)).toMatchObject(record)
    await writeJavaReplacementJournal(directory, { ...record, replacementRuntime: directory })
    await expect(readJavaReplacementJournal(directory, root, false)).rejects.toThrow('Invalid Java replacement journal')
    await writeJavaReplacementJournal(directory, { ...record, replacesJava: '/outside/bin/java' })
    await expect(readJavaReplacementJournal(directory, root, false)).rejects.toThrow('Invalid Java replacement journal')
    await removeJavaReplacementJournal(directory)
    expect(await readJavaReplacementJournal(directory, root, false)).toBeUndefined()
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
