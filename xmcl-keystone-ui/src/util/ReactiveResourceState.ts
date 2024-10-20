import { applyUpdateToResource, FileUpdateAction, FileUpdateOperation, Resource, ResourceState, UpdateResourcePayload } from '@xmcl/runtime-api'
import { set } from 'vue'

export class ReactiveResourceState extends ResourceState {
  override filesUpdates(ops: FileUpdateOperation[]) {
    const mods = [...this.files]
    for (const [payload, action] of ops) {
      if (action === FileUpdateAction.Upsert) {
        const index = mods.findIndex(m => m?.path === payload?.path)
        if (index === -1) {
          mods.push(markRaw(payload))
        } else {
          mods[index] = markRaw(payload)
        }
      } else if (action === FileUpdateAction.Remove) {
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
    set(this, 'files', mods)
  }
}
