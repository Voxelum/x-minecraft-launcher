<template>
  <div style="background: transparent; width: 100%">

    <ModloaderSelector
      :data="data"
      :versions="versions"
      :show-minecraft="showMinecraft"
    />

    <!-- Advanced Settings -->
    <v-expansion-panels variant="accordion" class="mt-6 bg-transparent">
      <v-expansion-panel elevation="0" style="background: transparent">
        <v-expansion-panel-title data-testid="add-instance-advanced" class="px-2 font-bold opacity-70">
          <v-icon start size="small">settings</v-icon> 
          {{ t('setting.advancedSettings') }}
        </v-expansion-panel-title>
        <v-expansion-panel-text class="px-0 pt-4">
          <div class="grid grid-cols-4 gap-4">
            <v-select
              v-model="data.java"
              variant="outlined"
              class="java-select col-span-2"
              item-title="text"
              :label="t('java.location')"
              :placeholder="t('java.allocatedLong')"
              :items="javaItems"
              :menu-props="{ }"
              hide-details
              required
            />
            <v-text-field
              v-model="data.minMemory"
              variant="outlined"
              hide-details
              type="number"
              :label="t('java.minMemory')"
              :placeholder="t('java.allocatedShort')"
              required
            />
            <v-text-field
              v-model="data.maxMemory"
              variant="outlined"
              hide-details
              type="number"
              :label="t('java.maxMemory')"
              :placeholder="t('java.allocatedShort')"
              required
            />
          </div>
        </v-expansion-panel-text>
      </v-expansion-panel>
    </v-expansion-panels>
  </div>
</template>

<script lang=ts setup>
import ModloaderSelector from '@/components/ModloaderSelector.vue'
import { kInstanceCreation } from '../composables/instanceCreation'
import { kJavaContext } from '../composables/java'

import { kLocalVersions } from '@/composables/versionLocal'
import { injection } from '@/util/inject'
import { computed } from 'vue'

defineProps({
  valid: {
    type: Boolean,
    required: true,
  },
  showMinecraft: {
    type: Boolean,
    default: true,
  },
})

const { data } = injection(kInstanceCreation)
const { t } = useI18n()
const { versions } = injection(kLocalVersions)

const { all: javas } = injection(kJavaContext)
const javaItems = computed(() => javas.value.map(java => ({
  text: `Java ${java.majorVersion} (${java.version})`,
  value: java.path,
})))
</script>

<style>
.java-select .v-select__selection {
  white-space: nowrap;
  overflow-x: hidden;
  overflow-y: hidden;
  max-width: 240px;
}
</style>
