import { JavaRecordSchema, type JavaRecord } from '@xmcl/runtime-api'
import { lstat, readFile, unlink } from 'fs/promises'
import { writeFile } from 'atomically'
import { isAbsolute, join, relative, resolve, sep } from 'path'
import { isSystemError } from '@xmcl/utils'
import { randomUUID } from 'crypto'

const journalName = '.xmcl-java-replacement.json'
const identityName = '.xmcl-java-identity'

/** Persist an identity that binds a replacement to the old directory, not just its path. */
export async function getOrCreateJavaRuntimeIdentity(directory: string): Promise<string> {
  if (!(await lstat(directory)).isDirectory()) throw new Error(`Invalid Java runtime directory: ${directory}`)
  const path = join(directory, identityName)
  let identity: string
  try {
    identity = await readFile(path, 'utf8')
  } catch (error) {
    if (!isSystemError(error) || error.code !== 'ENOENT') throw error
    identity = randomUUID()
    await writeFile(path, identity)
  }
  if (!/^[a-f0-9-]{36}$/i.test(identity)) throw new Error(`Invalid Java runtime identity in ${directory}`)
  return identity
}

/** Check the old directory's identity, accepting a directory that is already absent. */
export async function matchesJavaRuntimeIdentity(directory: string, expected?: string): Promise<boolean> {
  try {
    await lstat(directory)
  } catch (error) {
    // An already removed runtime needs no further identity check.
    if (isSystemError(error) && error.code === 'ENOENT') return true
    throw error
  }
  let actual: string | undefined
  try {
    actual = await readFile(join(directory, identityName), 'utf8')
  } catch (error) {
    if (!isSystemError(error) || error.code !== 'ENOENT') throw error
  }
  return !!expected && actual === expected
}

/** Persist replacement details alongside the staged runtime for crash recovery. */
export async function writeJavaReplacementJournal(directory: string, record: JavaRecord) {
  await writeFile(join(directory, journalName), JSON.stringify(record))
}

/** Read a replacement journal and validate paths before authorizing recovery. */
export async function readJavaReplacementJournal(directory: string, root: string, windows: boolean): Promise<JavaRecord | undefined> {
  let contents: string
  try {
    contents = await readFile(join(directory, journalName), 'utf8')
  } catch (error) {
    if (isSystemError(error) && error.code === 'ENOENT') return undefined
    throw error
  }
  const record = JavaRecordSchema.parse(JSON.parse(contents))
  const same = (left: string, right: string) => windows
    ? resolve(left).toLowerCase() === resolve(right).toLowerCase()
    : resolve(left) === resolve(right)
  const within = (path: string, parent: string) => {
    const rel = relative(resolve(parent), resolve(path))
    return !!rel && !isAbsolute(rel) && rel !== '..' && !rel.startsWith(`..${sep}`)
  }
  const old = record.replacementRuntime
  if (!record.isInternal || !record.installVendor || !record.replacesJava || !old ||
    !within(record.path, directory) || !within(old, root) ||
    !within(record.replacesJava, old) || same(old, directory) ||
    !same(join(root, relative(resolve(root), resolve(old)).split(sep)[0]), old)) {
    throw new Error(`Invalid Java replacement journal in ${directory}`)
  }
  return { ...record, valid: true }
}

/** Remove a completed replacement journal, tolerating an already absent file. */
export async function removeJavaReplacementJournal(directory: string) {
  try {
    await unlink(join(directory, journalName))
  } catch (error) {
    if (!isSystemError(error) || error.code !== 'ENOENT') throw error
  }
}
