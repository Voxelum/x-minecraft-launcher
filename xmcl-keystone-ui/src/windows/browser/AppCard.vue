<template>
  <div
    class="duration-400 flex cursor-pointer gap-5 rounded-xl p-2 transition-colors hover:bg-[rgba(255,255,255,0.1)]"
  >
    <div class="flex flex-grow-0 items-center">
      <img
        width="45px"
        height="45px"
        style="min-width: 45px; min-height: 45px;"
        contain
        :src="icon"
      >
    </div>
    <div class="flex flex-col">
      <span class="text-lg font-bold">{{ manifest.name }}</span>
      <span class="text-gray-400">{{ manifest.description }}</span>
      <span class="text-light-800 max-w-240 overflow-auto">{{ manifest.url }}</span>
      <v-divider v-if="manifest.screenshots.length > 0" />
      <div v-if="manifest.screenshots.length > 0">
        <span
          v-for="shot in manifest.screenshots"
          :key="shot.src"
        >
          <img :src="shot.src">
        </span>
      </div>
    </div>
    <div class="flex flex-grow-0 items-center gap-1">
      <v-chip
        v-if="defaultApp === manifest.url"
        color="primary"
      >
        {{ t('browseApp.default') }}
      </v-chip>
      <v-tooltip top>
        <template #activator="{ on }">
          <v-btn
            icon
            class="v-10"
            v-on="on"
            @click.stop.prevent="$emit('shortcut')"
          >
            <v-icon>shortcut</v-icon>
          </v-btn>
        </template>
        {{ t('browseApp.createShortcut') }}
      </v-tooltip>
      <v-tooltip top>
        <template #activator="{ on }">
          <v-btn
            icon
            class="v-10"
            v-on="on"
            @click.stop.prevent="$emit('boot')"
          >
            <v-icon>play_arrow</v-icon>
          </v-btn>
        </template>
        {{ t('browseApp.launch') }}
      </v-tooltip>
      <v-tooltip top>
        <template #activator="{ on }">
          <v-btn
            icon
            text
            color="error"
            v-on="on"
            @click.stop.prevent="$emit('uninstall')"
          >
            <v-icon>delete_outline</v-icon>
          </v-btn>
        </template>
        {{ t('browseApp.delete') }}
      </v-tooltip>
    </div>
  </div>
</template>
<script lang="ts" setup>
import { InstalledAppManifest } from '@xmcl/runtime-api'

import favicon from '@/assets/favicon.svg'

const props = defineProps<{
  manifest: InstalledAppManifest
  defaultApp: string
}>()
const { t } = useI18n()
const icon = computed(() => {
  if (!props.manifest?.iconUrls.icon) return favicon
  const icon = props.manifest.iconUrls.icon
  return new URL(icon, props.manifest.url).toString()
})
</script>
