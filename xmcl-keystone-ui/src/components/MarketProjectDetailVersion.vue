<template>
  <div
    class="rounded p-2 transition-colors duration-300 hover:bg-[rgba(0,0,0,0.15)]"
    :style="{ backgroundColor: version.installed ? 'rgba(0,0,0,0.25)' : '' }"
  >
    <div
      class="grid-cols-13 my-1 grid cursor-pointer gap-x-1 text-gray-700 dark:text-gray-300"
      @click="emit('click', version)"
    >
      <div class="col-span-5">
        <div>
          {{ version.name }}
        </div>
        <div class="mt-1">
          <span
            :style="{ color: color, borderColor: color }"
            class="border-l-[3px] pl-3 font-bold"
          >
            {{ t(`versionType.${version.type}`) }}
          </span>
          ·
          {{ version.version }}
        </div>
      </div>
      <div class="col-span-4">
        <div class="flex flex-wrap items-center">
          <div
            v-for="loader of loaders"
            :key="loader.loader"
            class="divide-light-600 mr-1 divide-x"
          >
            <v-icon v-if="loader.icon">
              {{ loader.icon }}
            </v-icon>
            <span v-else>
              {{ loader.loader }}
            </span>
          </div>
        </div>
        <div
          v-if="version.minecraftVersion"
          class="mr-1 mt-1"
        >
          {{ version.minecraftVersion }}
        </div>
      </div>
      <div class="col-span-4">
        <div v-if="version.downloadCount">
          {{ t('downloadCount', { count: version.downloadCount }) }}
        </div>
        <div
          v-if="version.createdDate"
          class="mt-1"
        >
          {{ getLocalDateString(version.createdDate) }}
        </div>
      </div>
    </div>
    <div
      v-if="showChangelog"
      :key="`${version.id}-changelog`"
      class="grid-cols-13 my-1.5 grid"
    >
      <!-- <div class="col-span-1" /> -->
      <div
        colspan="3"
        :style="{ borderColor: color }"
        class="col-span-13 border-l-[3px] pl-3"
      >
        <div
          v-if="!version.changelogLoading"
          class="markdown-body max-h-70 select-text overflow-auto text-gray-500 transition-colors hover:text-black dark:hover:text-gray-300"
          v-html="version.changelog"
        />
        <v-skeleton-loader
          v-else
          type="paragraph"
        />
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { useVuetifyColor } from '@/composables/vuetify'
import { getColorForReleaseType } from '@/util/color'
import { getLocalDateString } from '@/util/date'

const props = defineProps<{
  version: ProjectVersion
  showChangelog: boolean
}>()

const emit = defineEmits(['install', 'click'])

export interface ProjectVersion {
  id: string
  name: string
  version: string
  disabled: boolean
  installed: boolean
  type: 'release' | 'alpha' | 'beta'
  downloadCount: number
  loaders: string[]
  minecraftVersion?: string
  createdDate?: string | number
  changelog?: string
  changelogLoading?: boolean
}

const loaders = computed(() => props.version.loaders.map(l => {
  if (l.toLowerCase() === 'vanilla') return { icon: '$vuetify.icons.minecraft', loader: l }
  if (l.toLowerCase() === 'forge') return { icon: '$vuetify.icons.forge', loader: l }
  if (l.toLowerCase() === 'fabric') return { icon: '$vuetify.icons.fabric', loader: l }
  if (l.toLowerCase() === 'quilt') return { icon: '$vuetify.icons.quilt', loader: l }
  if (l.toLowerCase() === 'neoforge') return { icon: '$vuetify.icons.neoForged', loader: l }
  if (l.toLowerCase() === 'iris') return { icon: '$vuetify.icons.iris', loader: l }
  if (l.toLowerCase() === 'optifine') return { icon: '$vuetify.icons.optifine', loader: l }
  return { loader: l }
}))
const { getColorCode } = useVuetifyColor()
const color = computed(() => getColorCode(getColorForReleaseType(props.version.type)))
const { t } = useI18n()

</script>
