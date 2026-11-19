import { isAbsolute, relative, resolve, sep } from 'path'
import type { LauncherApp } from '~/app'
import { RestoreGate } from '~/infra/restoreGate'

function isWithin(path: string, directory: string) {
  if (!path) return false
  const rel = relative(resolve(directory), resolve(path))
  return !rel || (!isAbsolute(rel) && rel !== '..' && !rel.startsWith(`..${sep}`))
}

// Freeze reference edits while a Java replacement is migrated or removed.
export class JavaReferenceGate extends RestoreGate {
  private readonly retired = new Set<string>()

  constructor() {
    super('Java update maintenance is active')
  }

  /** Reject references into a retired runtime directory. */
  assertReference(path: string | null | undefined) {
    if (path && [...this.retired].some((directory) => isWithin(path, directory))) {
      throw new Error(`Java runtime has been replaced: ${path}`)
    }
  }

  /** Prevent stale edits from restoring references to a removed runtime. */
  retire(directory: string) {
    this.retired.add(resolve(directory))
  }

  /** Allow references again after an installation restores a retired path. */
  installed(path: string) {
    for (const directory of this.retired) {
      if (isWithin(path, directory)) this.retired.delete(directory)
    }
  }

  /** Guard a state mutation and validate each Java path it introduces. */
  guardReferenceMutation<T>(
    state: object,
    name: string,
    references: (payload: T) => Array<string | null | undefined>,
  ) {
    const method = Reflect.get(state, name)
    if (typeof method !== 'function')
      throw new TypeError(`Missing Java reference mutation: ${name}`)
    Reflect.set(state, name, (payload: T) => {
      this.assertWritable()
      for (const path of references(payload)) this.assertReference(path)
      return method.call(state, payload)
    })
  }
}

const gates = new WeakMap<LauncherApp, JavaReferenceGate>()

/** Return the shared Java reference gate for this launcher. */
export function getJavaReferenceGate(app: LauncherApp) {
  let gate = gates.get(app)
  if (!gate) {
    gate = new JavaReferenceGate()
    gates.set(app, gate)
  }
  return gate
}
