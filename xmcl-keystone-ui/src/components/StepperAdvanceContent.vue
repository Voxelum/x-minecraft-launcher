<template>
  <div style="background: transparent; width: 100%">
    <ModloaderSelector :data="data" :versions="versions" :show-minecraft="showMinecraft" />
    <!-- Advanced Settings -->
    <v-list-subheader data-testid="add-instance-advanced" class="my-4">
      {{ t('setting.advancedSettings') }}
    </v-list-subheader>
    <div class="grid grid-cols-4 gap-4">
      <v-select
        v-model="data.java"
        variant="outlined"
        class="java-select col-span-2"
        item-title="text"
        :label="t('java.location')"
        :placeholder="t('java.allocatedLong')"
        :items="javaItems"
        :menu-props="{}"
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
    <v-list-subheader v-if="isManual" class="mt-4">
      <div class="flex items-center gap-2">
        {{ t('instances.linkSharedFolders') }}
        <v-icon size="tiny" v-shared-tooltip="() => t('instances.linkSharedFoldersHint')">
          question_mark
        </v-icon>
      </div>
    </v-list-subheader>
    <v-list-item class="pt-0 pb-4 px-0" v-if="isManual">
      <div class="flex gap-2 items-center">
        <v-checkbox
          data-testid="add-instance-link-saves"
          v-model="linkPreferences.saves"
          hide-details
        >
          <template #label>
            <v-icon start>map </v-icon>
            {{ t('save.name') }}
          </template>
        </v-checkbox>
        <v-checkbox
          data-testid="add-instance-link-resourcepacks"
          v-model="linkPreferences.resourcepacks"
          hide-details
        >
          <template #label>
            <v-icon start>palette </v-icon>
            {{ t('resourcepack.name') }}
          </template>
        </v-checkbox>
        <v-checkbox
          data-testid="add-instance-link-shaderpacks"
          v-model="linkPreferences.shaderpacks"
          hide-details
        >
          <template #label>
            <v-icon start>gradient </v-icon>
            {{ t('shaderPack.name') }}
          </template>
        </v-checkbox>
      </div>
    </v-list-item>
  </div>
</template>

<script lang="ts" setup>
import ModloaderSelector from '@/components/ModloaderSelector.vue'
import SettingItemCheckbox from '@/components/SettingItemCheckbox.vue'
import { kInstanceCreation } from '../composables/instanceCreation'
import { kJavaContext } from '../composables/java'

import { kLocalVersions } from '@/composables/versionLocal'
import { injection } from '@/util/inject'
import { computed } from 'vue'
import { vSharedTooltip } from '@/directives/sharedTooltip'

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

const { data, linkPreferences, isManual } = injection(kInstanceCreation)
const { t } = useI18n()
const { versions } = injection(kLocalVersions)

const { all: javas } = injection(kJavaContext)
const javaItems = computed(() =>
  javas.value.map((java) => ({
    text: `Java ${java.majorVersion} (${java.version})`,
    value: java.path,
  })),
)
</script>

<style>
.java-select .v-select__selection {
  white-space: nowrap;
  overflow-x: hidden;
  overflow-y: hidden;
  max-width: 240px;
}

.link-folders--disabled {
  opacity: 0.5;
}
</style>
