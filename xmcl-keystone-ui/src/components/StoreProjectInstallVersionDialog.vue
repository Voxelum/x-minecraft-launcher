<template>
  <v-dialog
    :value="value"
    transition="fade-transition"
    width="700"
    @input="$emit('input', $event)"
  >
    <v-card
      rounded
      outlined
      class="visible-scroll flex max-h-[90vh] flex-col overflow-auto"
    >
      <div
        class="mx-5 mt-3 grid flex-grow-0 grid-cols-3 gap-5"
      >
        <v-select
          v-model="gameVersion"
          clearable
          hide-details
          flat
          solo
          :items="gameVersions"
          dense
          :label="t('modrinth.gameVersions.name')"
        />
        <v-select
          v-model="loader"
          clearable
          hide-details
          flat
          solo
          :items="loaders"
          dense
          :label="t('modrinth.modLoaders.name')"
        />
        <v-select
          v-model="versionType"
          clearable
          hide-details
          flat
          solo
          :items="versionTypes"
          dense
          :label="t('versionType.name')"
        />
      </div>
      <v-list color="transparent overflow-auto">
        <template
          v-for="version of all"
        >
          <template v-if="(typeof version === 'string')">
            <v-subheader
              :key="version"
            >
              <v-divider class="mx-4" />
              {{ t('modrinth.featuredVersions') }}
              <v-divider class="mx-4" />
            </v-subheader>
          </template>
          <v-list-item
            v-else
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
          </v-list-item>
        </template>
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

const props = defineProps<{
  versions: StoreProjectVersion[]
  value: boolean
}>()

const { t } = useI18n()

const emit = defineEmits(['install', 'input'])
const { getColorCode } = useVuetifyColor()

const gameVersions = computed(() => {
  const result = [] as string[]
  for (const v of props.versions) {
    for (const gv of v.game_versions) {
      if (!result.includes(gv)) result.push(gv)
    }
  }
  return result
})

const loaders = computed(() => {
  const result = [] as string[]
  for (const v of props.versions) {
    for (const gv of v.loaders) {
      if (!result.includes(gv)) result.push(gv)
    }
  }
  return result
})

const versionTypes = computed(() => {
  const result = [] as string[]
  for (const v of props.versions) {
    if (!result.includes(v.version_type)) result.push(v.version_type)
  }
  return result.map(v => ({ text: t(`versionType.${v}`), value: v }))
})

const gameVersion = ref('' as string)
const loader = ref('' as string)
const versionType = ref('' as string)

const filtered = computed(() => {
  const result = [] as StoreProjectVersion[]
  for (const v of props.versions) {
    if (gameVersion.value && !v.game_versions.includes(gameVersion.value)) continue
    if (loader.value && !v.loaders.includes(loader.value)) continue
    if (versionType.value && v.version_type !== versionType.value) continue
    result.push(v)
  }
  return result
})

const all = computed(() => {
  const originals = filtered.value
  const groupByGameVersionsByLoader = {} as Record<string, Record<string, StoreProjectVersion[]>>

  for (const v of originals) {
    const key = v.game_versions.join(' ')
    if (!groupByGameVersionsByLoader[key]) {
      groupByGameVersionsByLoader[key] = {}
    }
    const loaderKey = v.loaders.join(' ')
    if (!groupByGameVersionsByLoader[key][loaderKey]) {
      groupByGameVersionsByLoader[key][loaderKey] = []
    }

    groupByGameVersionsByLoader[key][loaderKey].push(v)
  }

  // Each game version, each loader should have a featured version
  // If has release use release as featured, otherwise use beta, otherwise use alpha
  const result = [] as StoreProjectVersion[]
  for (const key in groupByGameVersionsByLoader) {
    const versions = groupByGameVersionsByLoader[key]
    for (const loaderKey in versions) {
      const vers = versions[loaderKey]
      const release = vers.find(v => v.version_type === 'release')
      const beta = vers.find(v => v.version_type === 'beta')
      const alpha = vers.find(v => v.version_type === 'alpha')
      const ver = release || beta || alpha
      if (ver) result.push(ver)
    }
  }

  return [...result, 'divider', ...originals.filter(v => !result.includes(v))]
})

</script>
