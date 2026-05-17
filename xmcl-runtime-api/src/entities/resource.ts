import { type Resource, type ResourceActionTuple, type ResourceError, type ResourceErrorActionTuple, type UpdateResourcePayload } from '@xmcl/resource'

export function applyUpdateToResource(resource: Resource, update: UpdateResourcePayload) {
  resource.name = update.metadata?.name ?? resource.name
  for (const [key, val] of Object.entries(update.metadata ?? {})) {
    if (!val) continue
    (resource.metadata as any)[key] = val as any
  }
  resource.icons = update.icons ?? resource.icons
}

export class ResourceState {
  /**
   * The mods under instance folder
   */
  files = [] as Resource[]

  /**
   * Files in this directory that could not be parsed (broken zip,
   * permission, …). See `ResourceState.errors` in
   * `@xmcl/resource/ResourcesState.ts` for the contract — the runtime
   * pushes a `ResourceError` per failing file, and the renderer surfaces
   * them as a user-facing toast.
   */
  errors = [] as ResourceError[]

  filesUpdates(ops: ResourceActionTuple[]) {
    const files = [...this.files]
    for (const [r, a] of ops) {
      if (!r) {
        console.warn('Invalid resource', r)
        continue
      }
      if (a === 0) {
        const index = files.findIndex(m => m.path === r.path)
        if (index === -1) {
          files.push(r)
        } else {
          files[index] = r
        }
      } else if (a === 1) {
        const index = files.findIndex(m => m.path === r)
        if (index !== -1) files.splice(index, 1)
      } else {
        for (const update of r as UpdateResourcePayload[]) {
          for (const m of files) {
            if (m.hash === update.hash) {
              applyUpdateToResource(m, update)
            }
          }
        }
      }
    }
    this.files = files
  }

  errorsUpdates(ops: ResourceErrorActionTuple[]) {
    const errors = [...this.errors]
    for (const [payload, action] of ops) {
      if (action === 0) {
        const err = payload as ResourceError
        if (!err || !err.path) continue
        const index = errors.findIndex(e => e.path === err.path)
        if (index === -1) {
          errors.push(err)
        } else {
          errors[index] = err
        }
      } else {
        const path = payload as string
        const index = errors.findIndex(e => e.path === path)
        if (index !== -1) errors.splice(index, 1)
      }
    }
    this.errors = errors
  }
}
