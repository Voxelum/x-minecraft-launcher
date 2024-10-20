<template>
  <v-list-item
    :key="version.id"
    :disabled="disabled"
    v-on="!noClick ? { click: () => emit('click', version) } : {}"
  >
    <v-list-item-avatar>
      <v-icon
        class="material-icons-outlined"
      >
        {{ 'file_download' }}
      </v-icon>
    </v-list-item-avatar>
    <v-list-item-content>
      <v-list-item-title v-text="version.name" />
      <v-list-item-subtitle>
        <div>
          {{ version.loaders.join(' ') }}
          <template v-if="version.game_versions.length > 0">
            {{ version.game_versions.length === 1 ? version.game_versions[0] : version.game_versions[0] + '-' + version.game_versions[version.game_versions.length - 1] }}
          </template>
        </div>
        <span
          :style="{ color: getColorCode(getColorForReleaseType(version.version_type)) }"
        >
          •
          {{ t(`versionType.${version.version_type}`) }}
        </span>
      </v-list-item-subtitle>
    </v-list-item-content>
    <slot />
  </v-list-item>
</template>

<script lang="ts" setup>
import { useVuetifyColor } from '@/composables/vuetify'
import { getColorForReleaseType } from '@/util/color'
import { StoreProjectVersion } from './StoreProjectInstallVersionDialog.vue'

defineProps<{
  version: StoreProjectVersion
  noClick?: boolean
  disabled?: boolean
}>()

const { t } = useI18n()
const emit = defineEmits(['click'])
const { getColorCode } = useVuetifyColor()

</script>
