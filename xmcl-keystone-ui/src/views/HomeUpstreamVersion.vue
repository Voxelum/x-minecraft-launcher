<template>
  <v-card
    class="grid-cols-13 grid items-center gap-y-1 p-3 text-gray-700 dark:text-gray-300"
    :outlined="outlined"
    :style="{ 'content-visibility': 'auto' }"
    :color="color"
  >
    <div class="col-span-4">
      {{ version.name }}
    </div>
    <div class="col-span-2">
      <template v-for="l of version.loaders">
        <v-icon
          v-if="getLoader(l)"
          :key="l"
          v-shared-tooltip="l"
        >
          {{ getLoader(l) }}
        </v-icon>
        <span
          v-else
          :key="l"
        >{{ l }}</span>
      </template>
    </div>
    <div class="col-span-3">
      {{ t('downloadCount', { count: version.downloads }) }}
    </div>
    <div
      class="col-span-4 justify-self-end"
    >
      <v-btn
        v-if="!noAction"
        small
        :color="downgrade ? 'warning' : 'primary'"
        :loading="updating"
        @click="$emit('update', version)"
      >
        {{ downgrade? t('upstream.downgrade') : t('upstream.update') }}
        <v-icon right>
          {{ downgrade ? 'keyboard_double_arrow_down' : 'upgrade' }}
        </v-icon>
      </v-btn>
    </div>
    <div class="col-span-4">
      <span
        :style="{ color: getColorCode(getColorForReleaseType(version.versionType)),borderColor: getColorCode(getColorForReleaseType(version.versionType)) }"
        class="border-l-[3px] pl-3 font-bold"
      >
        {{ t(`versionType.${version.versionType}`) }}
      </span>
      ·
      {{ version.versionNumber }}
    </div>
    <div class="col-span-2">
      {{ version.gameVersions.join(', ') }}
    </div>
    <div class="col-span-3">
      {{ getDateString(version.datePublished, { timeStyle: 'short', dateStyle: 'long' }) }}
    </div>
    <div
      class="col-span-4 justify-self-end"
    >
      <v-btn
        v-if="!noAction"
        small
        text
        :loading="duplicating"
        @click="$emit('duplicate', version)"
      >
        {{ t('instances.add') }}
        <v-icon right>
          add
        </v-icon>
      </v-btn>
    </div>
    <div
      v-if="version.changelog"
      :key="`${version.id}-changelog`"
      class="col-span-13 select-text"
    >
      <div
        :style="{ borderColor: getColorCode(getColorForReleaseType(version.versionType)) }"
        class="border-l-[3px] pl-3"
      >
        <div
          class="markdown-body hover:(bg-[rgba(0,0,0,0.05)]) dark:hover:(bg-[rgba(0,0,0,0.3)]) max-h-140 overflow-auto rounded-lg bg-[rgba(0,0,0,0.07)] py-2 pl-2 text-gray-500 transition-colors hover:text-black dark:bg-[rgba(0,0,0,0.4)] dark:hover:text-gray-300"
          v-html="version.changelog"
        />
      </div>
    </div>
  </v-card>
</template>
<script lang="ts" setup>
import { useDateString } from '@/composables/date'
import { useMarkdown } from '@/composables/markdown'
import { useVuetifyColor } from '@/composables/vuetify'
import { vSharedTooltip } from '@/directives/sharedTooltip'
import { getColorForReleaseType } from '@/util/color'

export interface ProjectVersionProps {
  id: string
  name: string
  versionType: 'release' | 'beta' | 'alpha'
  versionNumber: string
  loaders: string[]
  gameVersions: string[]
  downloads: number
  datePublished: string
  changelog: string
}

const props = defineProps<{
  version: ProjectVersionProps
  downgrade?: boolean
  color?: string
  noAction?: boolean
  outlined?: boolean
  duplicating?: boolean
  updating?: boolean
}>()

const emit = defineEmits(['update', 'duplicate', 'changelog'])

const version = computed(() => props.version)
const { getColorCode } = useVuetifyColor()
const { t } = useI18n()
const { render } = useMarkdown()
const getLoader = (loader: string) => {
  loader = loader.toLowerCase()
  if (loader === 'forge') return '$vuetify.icons.forge'
  if (loader === 'fabric') return '$vuetify.icons.fabric'
  return ''
}
const { getDateString } = useDateString()

watch(() => props.version, () => {
  emit('changelog')
}, { immediate: true })
</script>
