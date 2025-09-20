import { ResourceAction, type Resource, type ResourceActionTuple, type UpdateResourcePayload } from '@xmcl/resource'

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
}
