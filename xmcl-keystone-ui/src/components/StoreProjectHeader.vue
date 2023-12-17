<template>
  <div
    class="flex flex-col p-4"
  >
    <div class="flex flex-grow-0 items-center gap-4 xl:flex-col">
      <v-img
        max-width="150"
        :src="project.iconUrl"
      />
      <div class="flex  gap-4 xl:flex-col">
        <div class="flex flex-col gap-4">
          <div class="flex flex-col gap-2">
            <a
              class="overflow-hidden text-2xl font-bold"
              target="browser"
              :href="project.url"
            >
              {{ project.title }}
            </a>

            <span>{{ project.description }}</span>
          </div>
          <span class="flex select-none flex-wrap gap-3 xl:justify-center">
            <CategoryChip
              v-for="item of project.categories"
              :key="item.text"
              :item="item"
            />
          </span>
        </div>

        <div class="flex flex-grow-0 flex-col items-center justify-center gap-2 xl:flex-row">
          <v-btn
            v-if="!installed"
            color="primary"
            :loading="installing"
            @click="$emit('install')"
          >
            <v-icon
              left
              class="material-icons-outlined"
            >
              file_download
            </v-icon>
            {{ t('install') }}
          </v-btn>
          <v-btn
            v-else
            color="blue"
            @click="$emit('open')"
          >
            <v-icon
              left
              class="material-icons-outlined"
            >
              play_arrow
            </v-icon>
            {{ t('launch.launch') }}
          </v-btn>
        </div>
      </div>
    </div>
    <div class="my-2 w-full flex-grow xl:my-0" />
    <div
      class="flex select-none items-center gap-6 text-gray-400"
      style="width: max-content;"
    >
      <template
        v-for="(x, i) of items"
      >
        <InfoHighlight
          :key="x.name"
          :value="x"
        />
        <v-divider
          v-if="i !== items.length - 1"
          :key="x.name + 'divider'"
          vertical
        />
      </template>
    </div>
  </div>
</template>
<script lang="ts" setup>
import { getExpectedSize } from '@/util/size'
import { StoreProject } from './StoreProject.vue'
import CategoryChip from './CategoryChip.vue'
import InfoHighlight from './InfoHighlight.vue'
import { useDateString } from '@/composables/date'

const props = defineProps<{
  project: StoreProject
  installing: boolean
  installed?: boolean
}>()

const emit = defineEmits(['install', 'open'])
const { t } = useI18n()

const { getDateString } = useDateString()
const items = computed(() => {
  return [{
    icon: 'file_download',
    name: t('modrinth.downloads'),
    value: getExpectedSize(props.project.downloads, ''),
  }, {
    icon: 'star_rate',
    name: t('modrinth.followers'),
    value: props.project.follows,
  }, {
    icon: 'event',
    name: t('modrinth.createAt'),
    value: getDateString(props.project.createDate),
  }, {
    icon: 'update',
    name: t('modrinth.updateAt'),
    value: getDateString(props.project.updateDate),
  }]
})
</script>
