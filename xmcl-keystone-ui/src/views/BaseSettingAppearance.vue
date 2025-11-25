<template>
  <div>
    <v-list-item class="items-center justify-center">
      <v-list-item-content>
        <v-list-item-title>
          {{ t("setting.instanceTheme.name") }}
        </v-list-item-title>
        <v-list-item-subtitle v-if="!instanceTheme">
          {{ t("setting.instanceTheme.description") }}
        </v-list-item-subtitle>
        <v-list-item-subtitle v-else>
          {{ t("setting.instanceTheme.activeDescription") }}
        </v-list-item-subtitle>
      </v-list-item-content>
      <v-list-item-action>
        <v-switch
          :input-value="!!instanceTheme"
          @change="toggleInstanceTheme"
        />
      </v-list-item-action>
    </v-list-item>
    <AppearanceItems v-if="instanceTheme" :theme="instanceTheme" @save="onSave" />
  </div>
</template>
<script lang="ts" setup>
import AppearanceItems from '@/components/AppearanceItems.vue'
import { kInstanceTheme } from '@/composables/instanceTheme'
import { kTheme } from '@/composables/theme'
import { injection } from '@/util/inject'

const { t } = useI18n()
const { instanceTheme, saveTheme, clearTheme } = injection(kInstanceTheme)
const { currentTheme, update } = injection(kTheme)

async function toggleInstanceTheme(enabled: boolean) {
  if (enabled) {
    // Create a deep copy of the current global theme
    instanceTheme.value = JSON.parse(JSON.stringify(currentTheme.value))
    await saveTheme()
  } else {
    await clearTheme()
    update()
  }
}

function onSave() {
  saveTheme().then(() => {
    update()
  })
}
</script>
