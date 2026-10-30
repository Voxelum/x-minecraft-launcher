import type { InstanceSchema } from '@xmcl/instance'
import type { CollectionsFileSchema, SettingSchema } from '@xmcl/runtime-api'
import type { InjectionKey } from '~/app'

export interface RestoreInstancePlan {
  path: string
  /** Prevalidated portable instance.json, not a loaded service instance. */
  data: ReturnType<typeof InstanceSchema.parse>
}
export interface RestorePublishPlan {
  settings?: SettingSchema
  /** Full merged collections file, rather than only incoming collections. */
  collections?: ReturnType<typeof CollectionsFileSchema.parse>
  instances: RestoreInstancePlan[]
}
export interface RestoreMaintenanceLease {
  /** Pure preparation: serialize the prospective instances.json without changing
   * state or disk. Paths in the returned file must use normal managed-relative
   * serialization. Only requested when instances are being restored. */
  prepareInstances(instances: RestoreInstancePlan[]): Promise<Buffer>
  /** Publish all already-committed disk candidates without initiating persistence,
   * migrations, instance folder renames, or other asynchronous writes. */
  publish(plan: RestorePublishPlan): Promise<void>
  /** Restore every captured state snapshot, including after partial publication;
   * must not write the captured state to disk (transaction rollback did that). */
  undoPublish(): Promise<void>
  /** Resume normal persistence only after commit/rollback. When recoveryRequired
   * is true keep conflicting writes/launch/install blocked until restart recovery;
   * do not flush newly published data over retained originals. */
  release(recoveryRequired: boolean): Promise<void>
}
export interface RestoreMaintenance {
  /** Holds an app-scoped barrier before reading existing candidates: drain all
   * relevant pending writes, reject running instances, block new launches,
   * installs and settings/collection/theme/instance mutations. No best-effort
   * swallow-error saver may be used as evidence that the drain succeeded. */
  enter(): Promise<RestoreMaintenanceLease>
}
export const kRestoreMaintenance: InjectionKey<RestoreMaintenance> = Symbol('restoreMaintenance')
