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
    <AppearanceItems v-if="instanceTheme" :theme="instanceTheme" :instance-path="instancePath" @save="onSave" />
  </div>
</template>
<script lang="ts" setup>
import AppearanceItems from '@/components/AppearanceItems.vue'
import { kInstance } from '@/composables/instance'
import { kInstanceTheme } from '@/composables/instanceTheme'
import { useService } from '@/composables/service'
import { kTheme } from '@/composables/theme'
import { injection } from '@/util/inject'
import { InstanceThemeServiceKey } from '@xmcl/runtime-api'

const { t } = useI18n()
const { path: instancePath } = injection(kInstance)
const { instanceTheme, saveTheme, clearTheme } = injection(kInstanceTheme)
const { currentTheme, update } = injection(kTheme)
const { copyMediaFromGlobal } = useService(InstanceThemeServiceKey)

async function toggleInstanceTheme(enabled: boolean) {
  if (enabled) {
    // Create a deep copy of the current global theme
    const themeCopy = JSON.parse(JSON.stringify(currentTheme.value))
    // Copy media files to instance theme folder
    if (themeCopy.backgroundImage?.url?.startsWith('http://launcher/theme-media/')) {
      try {
        const newMedia = await copyMediaFromGlobal(instancePath.value, themeCopy.backgroundImage.url)
        themeCopy.backgroundImage = newMedia
      } catch {
        themeCopy.backgroundImage = undefined
      }
    }
    if (themeCopy.font?.url?.startsWith('http://launcher/theme-media/')) {
      try {
        const newMedia = await copyMediaFromGlobal(instancePath.value, themeCopy.font.url)
        themeCopy.font = newMedia
      } catch {
        themeCopy.font = undefined
      }
    }
    if (themeCopy.backgroundMusic?.length > 0) {
      const newMusic = []
      for (const music of themeCopy.backgroundMusic) {
        if (music?.url?.startsWith('http://launcher/theme-media/')) {
          try {
            const newMedia = await copyMediaFromGlobal(instancePath.value, music.url)
            newMusic.push(newMedia)
          } catch {
            // Skip failed copies
          }
        }
      }
      themeCopy.backgroundMusic = newMusic
    }
    instanceTheme.value = themeCopy
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
