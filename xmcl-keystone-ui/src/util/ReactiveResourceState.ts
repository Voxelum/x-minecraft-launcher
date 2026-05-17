import { ResourceAction, ResourceActionTuple, ResourceError, ResourceErrorAction, ResourceErrorActionTuple, UpdateResourcePayload } from '@xmcl/resource'
import { ResourceState, applyUpdateToResource } from '@xmcl/runtime-api'


export class ReactiveResourceState extends ResourceState {
  override filesUpdates(ops: ResourceActionTuple[]) {
    const mods = [...this.files]
    for (const [payload, action] of ops) {
      if (action === ResourceAction.Upsert) {
        const index = mods.findIndex(m => m?.path === payload?.path)
        if (index === -1) {
          mods.push(markRaw(payload))
        } else {
          mods[index] = markRaw(payload)
        }
      } else if (action === ResourceAction.Remove) {
        const index = mods.findIndex(m => m?.path === payload)
        if (index !== -1) mods.splice(index, 1)
      } else {
        for (const update of payload as any as UpdateResourcePayload[]) {
          for (const m of mods) {
            if (m.hash === update.hash) {
              applyUpdateToResource(m, update)
            }
          }
        }
      }
    }
    this['files'] = mods
  }

  override errorsUpdates(ops: ResourceErrorActionTuple[]) {
    const errors = [...this.errors]
    for (const [payload, action] of ops) {
      if (action === ResourceErrorAction.Upsert) {
        const err = payload as ResourceError
        if (!err || !err.path) continue
        const index = errors.findIndex(e => e.path === err.path)
        if (index === -1) {
          errors.push(markRaw(err))
        } else {
          errors[index] = markRaw(err)
        }
      } else {
        const path = payload as string
        const index = errors.findIndex(e => e.path === path)
        if (index !== -1) errors.splice(index, 1)
      }
    }
    this['errors'] = errors
  }
}
