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
    <div class="flex items-center flex-grow-0">
      <v-chip
        v-if="defaultApp === manifest.url"
        color="primary"
      >
        DEFAULT
      </v-chip>
      <v-btn
        icon
        class="v-10"
        @click.stop.prevent="$emit('boot')"
      >
        <v-icon>play_arrow</v-icon>
      </v-btn>
      <v-btn
        icon
        flat
        color="red"
        @click.stop.prevent="$emit('uninstall')"
      >
        <v-icon>delete_outline</v-icon>
      </v-btn>
    </div>
  </div>
</template>
<script lang="ts">
import { computed, defineComponent, reactive, toRefs } from '@vue/composition-api'
import { AppManifest, InstalledAppManifest } from '@xmcl/runtime-api'
import { required } from '/@/util/props'
import favicon from '/@/assets/favicon.svg'

export default defineComponent({
  props: {
    manifest: required<InstalledAppManifest>(Object),
    defaultApp: required(String),
  },
  setup(props) {
    const icon = computed(() => {
      if (!props.manifest?.icons) return favicon
      const icons = props.manifest.icons
      console.log(icons)
      const maskable = icons.find(i => i.purpose === 'maskable')
      if (maskable?.src) {
        return new URL(maskable.src, props.manifest.url).toString()
      }
      return icons[0]?.src ? new URL(icons[0].src, props.manifest.url).toJSON() : favicon
    })
    return {
      icon,
    }
  },
})
</script>
