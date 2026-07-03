<template>
  <SettingCard
    :title="t('setting.instanceTheme.name')"
    :subtitle="
      !instanceTheme
        ? t('setting.instanceTheme.description')
        : t('setting.instanceTheme.activeDescription')
    "
    icon="palette"
  >
    <template #header-action>
      <v-switch
        :model-value="!!instanceTheme"
        color="primary"
        hide-details
        density="compact"
        @update:model-value="(v) => toggleInstanceTheme(!!v)"
      />
    </template>

    <AppearanceItems
      v-if="instanceTheme"
      :theme="instanceTheme"
      dense
      :instance-path="instancePath"
      @save="onSave"
    />
  </SettingCard>
</template>
<script lang="ts" setup>
import SettingCard from '@/components/SettingCard.vue'
import AppearanceItems from '@/components/AppearanceItems.vue'
import { kInstance } from '@/composables/instance'
import { kInstanceTheme } from '@/composables/instanceTheme'
import { useService } from '@/composables/service'
import { kTheme } from '@/composables/theme'
import { injection } from '@/util/inject'
import { InstanceThemeServiceKey, ThemeServiceKey } from '@xmcl/runtime-api'
import { useGamepadAction } from '@/composables/gamepad'

const { t } = useI18n()
const { path: instancePath } = injection(kInstance)
const { instanceTheme, saveTheme, clearTheme, setCustomCss } = injection(kInstanceTheme)
const { currentTheme } = injection(kTheme)
const { copyMediaFromGlobal } = useService(InstanceThemeServiceKey)
const { getCustomCss } = useService(ThemeServiceKey)

async function toggleInstanceTheme(enabled: boolean) {
  if (enabled) {
    // Create a deep copy of the current global theme
    const themeCopy = JSON.parse(JSON.stringify(currentTheme.value))
    // Copy media files to instance theme folder
    if (themeCopy.backgroundImage?.url?.startsWith('http://launcher/theme-media/')) {
      try {
        const newMedia = await copyMediaFromGlobal(
          instancePath.value,
          themeCopy.backgroundImage.url,
        )
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
    // Seed the instance's custom CSS from the global one so it starts identical.
    try {
      const globalCss = await getCustomCss()
      if (globalCss) await setCustomCss(globalCss)
    } catch {
      // ignore — instance simply starts with empty custom CSS
    }
  } else {
    await clearTheme()
  }
}

function onSave() {
  saveTheme()
}

// Gamepad X on the appearance tab toggles the per-instance theme.
useGamepadAction('X', {
  label: () => t('setting.instanceTheme.name'),
  handler: () => toggleInstanceTheme(!instanceTheme.value),
})
</script>
