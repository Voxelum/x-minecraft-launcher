<template>
  <v-slide-group
    style="max-width: 100%;"
    mandatory
    center-active
    active-class="success"
    show-arrows
  >
    <v-slide-item
      v-for="v in versions"
      :key="v.id"
      v-slot="{ active, toggle }"
    >
      <div
        v-ripple
        class="flex cursor-pointer select-none rounded p-2 transition-colors"
        :input-value="active"
        @click="toggle"
      >
        <v-icon
          left
          large
          class="material-icons-outlined"
        >
          file_download
        </v-icon>
        <div>
          <span class="mr-1">
            {{ v.name }}
          </span>
          <div class="font-bold">
            <v-icon>
              {{ getIcon(v.loaders[0]) }}
            </v-icon>
            {{ v.game_versions.join(' ') }}
          </div>
          {{ getType(v.version_type) }}
        </div>
      </div>
    </v-slide-item>
  </v-slide-group>
</template>
<script setup lang="ts">
import { useSWRVModel } from '@/composables/swrv'
import { StoreProject } from './StoreProject.vue'
import { getModrinthVersionModel } from '@/composables/modrinthVersions'

const props = defineProps<{
  project: StoreProject
}>()

const getIcon = (loader: string) => {
  if (loader === 'fabric') return '$vuetify.icons.fabric'
  if (loader === 'forge') return '$vuetify.icons.forge'
  if (loader === 'quilt') return '$vuetify.icons.forge'
  return '$vuetify.icons.minecraft'
}
const { t } = useI18n()
const getType = (type: string) => {
  if (type === 'release') return t('versionType.release')
  if (type === 'alpha') return t('versionType.alpha')
  if (type === 'beta') return t('versionType.beta')
  return ''
}
const { data, error, isValidating } = useSWRVModel(getModrinthVersionModel(computed(() => props.project.id), true, ref(undefined), ref(undefined)))

const versions = computed(() => data.value || [])

</script>
