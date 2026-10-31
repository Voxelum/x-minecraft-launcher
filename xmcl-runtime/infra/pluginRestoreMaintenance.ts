import { SettingSchema, CollectionsFileSchema, CURRENT_COLLECTION_SCHEMA_VERSION } from '@xmcl/runtime-api'
import type { LauncherAppPlugin } from '~/app'
import { kRestoreMaintenance } from '~/backup/restoreMaintenance'
import { CollectionService } from '~/collection/CollectionService'
import { InstanceService } from '~/instance/InstanceService'
import { LaunchService } from '~/launch/LaunchService'
import { kSettings } from '~/settings'
import { ThemeService } from '~/theme/ThemeService'
import { getRestoreGate } from './restoreGate'
import { recoverRestore } from './recoverRestore'

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value))

export const pluginRestoreMaintenance: LauncherAppPlugin = (app) => {
  app.registry.register(kRestoreMaintenance, {
    async enter() {
      await recoverRestore(app)
      const [settings, collections, instances, launch, theme] = await Promise.all([
        app.registry.get(kSettings), app.registry.get(CollectionService), app.registry.get(InstanceService),
        app.registry.get(LaunchService), app.registry.get(ThemeService),
      ])
      await Promise.all([collections.initialize(), instances.initialize(), theme.initialize()])
      const gate = getRestoreGate(app)
      await gate.enter(() => {
        if (launch.getProcesses().length) throw new Error('Cannot restore while an instance is running')
      })
      const beforeSettings = SettingSchema.parse(clone(settings))
      const beforeCollections = CollectionsFileSchema.parse({ schemaVersion: CURRENT_COLLECTION_SCHEMA_VERSION, collections: clone(collections.state.collections) })
      const corrupted = collections.state.corrupted
      const beforeInstances = clone(instances.state.instances)
      const beforeGroups = clone(instances.state.groups)
      let released = false
      const assertLease = () => { if (released) throw new Error('Restore lease released') }
      return {
        async prepareInstances(incoming) {
          assertLease()
          return instances.prepareRestoreInstances(incoming)
        },
        async publish(plan) {
          assertLease()
          gate.publish(() => {
            if (plan.settings) settings.config(plan.settings)
            if (plan.collections) collections.publishRestore(plan.collections)
            instances.publishRestoreInstances(plan.instances)
          })
        },
        async undoPublish() {
          assertLease()
          gate.publish(() => {
            settings.config(beforeSettings)
            collections.publishRestore(beforeCollections)
            collections.state.collectionCorrupted(corrupted)
            instances.state.instanceRestore(beforeInstances)
            instances.state.instanceGroupsSet(beforeGroups)
          })
        },
        async release(recoveryRequired) {
          assertLease()
          released = true
          gate.release(recoveryRequired)
        },
      }
    },
  })
}
