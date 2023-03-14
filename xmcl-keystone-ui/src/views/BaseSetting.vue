<template>
  <div class="mx-6">
    <BaseSettingGeneral />
    <BaseSettingSync />
    <BaseSettingModpack v-if="!isServer" />
    <BaseSettingServer v-else />
    <BaseSettingJava />
    <BaseSettingLaunch />

    <v-snackbar
      color="black"
      :timeout="-1"

      :value="edit.isModified"
    >
      <div class="mr-4 text-button">
        {{ t('instance.setting.unsaved') }}
      </div>

      <template #action="{ attrs }">
        <div
          class="flex gap-1 mr-2"
          v-bind="attrs"
        >
          <v-btn
            text
            @click="onReset"
          >
            {{ t('instance.setting.reset') }}
          </v-btn>

          <v-btn
            color="primary"
            @click="edit.save"
          >
            {{ t('instance.setting.save') }}
          </v-btn>
        </div>
      </template>
    </v-snackbar>
  </div>
</template>

<script lang=ts setup>
import { useAutoSaveLoad } from '@/composables'
import { kInstanceContext } from '@/composables/instanceContext'
import { usePresence } from '@/composables/presence'
import { injection } from '@/util/inject'
import { InstanceEditInjectionKey, useInstanceEdit } from '../composables/instanceEdit'
import BaseSettingGeneral from './BaseSettingGeneral.vue'
import BaseSettingJava from './BaseSettingJava.vue'
import BaseSettingLaunch from './BaseSettingLaunch.vue'
import BaseSettingModpack from './BaseSettingModpack.vue'
import BaseSettingServer from './BaseSettingServer.vue'
import BaseSettingSync from './BaseSettingSync.vue'

const { isServer, name, instance } = injection(kInstanceContext)
const edit = useInstanceEdit(instance)
const { t } = useI18n()
provide(InstanceEditInjectionKey, edit)
useAutoSaveLoad(() => {}, edit.load)

function onReset() {
  edit.load()
}

usePresence({ location: 'instance-setting', instance: name.value })
</script>

<style scoped=true>
/* .flex {
  padding: 6px 8px !important
} */

/* .v-btn {
  margin: 0
} */
</style>
<style>
.local-version .v-select__selection--comma {
  max-width: 100px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.base-settings {
  background: transparent !important;
  width: 100%;
}

.base-settings .v-text-field--box input,
.v-text-field--full-width input,
.v-text-field--outlined input {
  margin-top: 0
}

/* .base-settings .v-list__tile__content {
  flex-grow: 1
  max-width: 40%
} */
</style>
