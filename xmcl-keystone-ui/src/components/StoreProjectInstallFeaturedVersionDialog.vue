<template>
  <v-dialog
    :value="value"
    hide-overlay
    transition="dialog-bottom-transition"
    width="500"
    @input="$emit('input', $event)"
  >
    <v-card
      rounded
      outlined
      class="max-h-200 visible-scroll overflow-auto"
    >
      <v-list color="transparent">
        <v-list-item
          v-for="version of versions"
          :key="version.id"
          @click="emit('install', version)"
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
                {{ version.game_versions.length === 1 ? version.game_versions[0] : version.game_versions[0] + '-' + version.game_versions[version.game_versions.length - 1] }}
              </div>
              <span
                :style="{ color: getColorCode(getColorForReleaseType(version.version_type)) }"
              >
                •
                {{ t(`versionType.${version.version_type}`) }}
              </span>
            </v-list-item-subtitle>
          </v-list-item-content>
        </v-list-item>
      </v-list>
    </v-card>
  </v-dialog>
</template>

<script lang="ts" setup>
import { useVuetifyColor } from '@/composables/vuetify'
import { getColorForReleaseType } from '@/util/color'

export interface StoreProjectVersion {
  id: string
  name: string
  version_type: string
  game_versions: string[]
  loaders: string[]
}

defineProps<{
  versions: StoreProjectVersion[]
  value: boolean
}>()

const { t } = useI18n()

const emit = defineEmits(['install', 'input'])
const { getColorCode } = useVuetifyColor()
</script>
