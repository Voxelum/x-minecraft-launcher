<template>
  <div
    class="flex gap-5 p-2 hover:bg-[rgba(255,255,255,0.1)] cursor-pointer transition-colors duration-400 rounded-xl"
  >
    <div class="flex items-center flex-grow-0">
      <img
        width="45px"
        height="45px"
        style="min-width: 45px; min-height: 45px;"
        contain
        :src="icon"
      >
    </div>
    <div class="flex flex-col">
      <span class="font-bold text-lg">{{ manifest.name }}</span>
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
    <div class="flex items-center flex-grow-0 gap-1">
      <v-chip
        v-if="defaultApp === manifest.url"
        color="primary"
      >
        {{ $t('default') }}
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
        {{ $t('createShortcut') }}
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
        {{ $t('launch') }}
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
        {{ $t('delete') }}
      </v-tooltip>
    </div>
  </div>
</template>
<script lang="ts">
import { computed, defineComponent } from '@vue/composition-api'
import { InstalledAppManifest } from '@xmcl/runtime-api'
import favicon from '/@/assets/favicon.svg'
import { required } from '/@/util/props'

export default defineComponent({
  props: {
    manifest: required<InstalledAppManifest>(Object),
    defaultApp: required(String),
  },
  setup(props) {
    const icon = computed(() => {
      if (!props.manifest?.iconUrls.icon) return favicon
      const icon = props.manifest.iconUrls.icon
      return new URL(icon, props.manifest.url).toString()
    })
    return {
      icon,
    }
  },
})
</script>
