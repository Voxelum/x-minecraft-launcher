<template>
  <div class="store-project-header flex flex-col gap-4 p-5">
    <div class="flex items-start gap-4">
      <v-avatar
        v-if="project.iconUrl"
        size="80"
        rounded="lg"
        class="flex-shrink-0 bg-transparent"
      >
        <v-img :src="project.iconUrl" />
      </v-avatar>
      <v-avatar
        v-else
        size="80"
        rounded="lg"
        color="primary"
        variant="tonal"
        class="flex-shrink-0"
      >
        <v-icon size="40">extension</v-icon>
      </v-avatar>
      <div class="flex flex-col gap-1 min-w-0 flex-1">
        <a
          class="text-2xl font-bold leading-tight truncate hover:text-primary transition-colors"
          target="browser"
          :href="project.url"
        >
          {{ project.localizedTitle || project.title }}
        </a>
        <span class="text-sm opacity-80 line-clamp-2">
          {{ project.localizedDescription || project.description }}
        </span>
        <span
          v-if="project.categories.length"
          class="flex select-none flex-wrap gap-2 mt-2"
        >
          <CategoryChip
            v-for="item of project.categories"
            :key="item.id"
            :item="item"
            small
          />
        </span>
      </div>
      <div class="flex flex-shrink-0 flex-col gap-2 items-stretch">
        <v-btn
          data-testid="store-install"
          color="primary"
          variant="flat"
          prepend-icon="file_download"
          :loading="installing"
          @click="$emit('install')"
        >
          {{ t('shared.install') }}
        </v-btn>
        <v-btn
          v-if="installed"
          color="info"
          variant="tonal"
          prepend-icon="play_arrow"
          @click="$emit('open')"
        >
          {{ t('launch.launch') }}
        </v-btn>
      </div>
    </div>
    <v-divider />
    <div class="store-project-header__stats grid grid-cols-2 sm:grid-cols-4 gap-2 select-none">
      <div
        v-for="x of items"
        :key="x.name"
        class="stat-item"
      >
        <div class="stat-item__value">
          {{ x.value }}
        </div>
        <div class="stat-item__label">
          <v-icon size="14" class="material-icons-outlined">{{ x.icon }}</v-icon>
          <span>{{ x.name }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
<script lang="ts" setup>
import { useDateString } from '@/composables/date'
import { getExpectedSize } from '@/util/size'
import CategoryChip from './CategoryChip.vue'
import { StoreProject } from './StoreProject.vue'

const props = defineProps<{
  project: StoreProject
  installing: boolean
  installed?: boolean
}>()

defineEmits(['install', 'open'])
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

<style scoped>
.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  padding: 8px 4px;
  border-radius: 8px;
  background: rgba(var(--v-theme-on-surface), 0.03);
}
.stat-item__value {
  font-size: 1.05rem;
  font-weight: 700;
  line-height: 1.2;
}
.stat-item__label {
  font-size: 0.7rem;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  opacity: 0.7;
  white-space: nowrap;
}
</style>

