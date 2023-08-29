<template>
  <div class="modrinth mb-1 grid w-full grid-cols-12 gap-2 overflow-auto p-4 pb-0">
    <v-progress-linear
      class="absolute left-0 top-0 z-10 m-0 p-0"
      :active="refreshing"
      height="3"
      :indeterminate="true"
    />
    <div class="relative flex flex-col gap-2 overflow-auto md:col-span-12 lg:col-span-9">
      <div class="hover:(scale-100 opacity-100) absolute bottom-3 z-10 w-full scale-90 transform opacity-60 transition">
        <v-pagination
          v-model="_page"
          :length="pageCount"
          color="success"
          :disabled="refreshing"
          :total-visible="12"
        />
      </div>
      <v-card
        class="flex flex-shrink flex-grow-0 py-1"
        outlined
      >
        <span class="min-w-36 flex flex-1 flex-shrink items-center justify-center">
          <v-select
            v-model="_projectType"
            flat
            solo
            :items="projectTypes"
            hide-details
          />
        </span>
        <v-text-field
          v-model="keyword"
          color="green"
          append-icon="search"
          solo
          flat
          hide-details
          :placeholder="t('modrinth.searchText')"
          @keypress.enter="_query = keyword"
        />
        <v-select
          v-model="_sortBy"
          :item-value="
            // @ts-expect-error
            v => v.name"
          class="max-w-40"
          hide-details
          flat
          :label="t('modrinth.sort.title')"
          :items="sortOptions"
        />
        <v-select
          v-model="pageSize"
          class="max-w-40"
          :items="pageSizeOptions"
          hide-details
          flat
          :label="t('modrinth.perPage')"
        />
      </v-card>

      <div
        v-if="!searchError && projects.length > 0"
        class="flex flex-col gap-3 overflow-auto px-2.5"
      >
        <ModrinthModCard
          v-for="mod in projects"
          :key="mod.project_id"
          v-ripple
          :disabled="false"
          :value="mod"
          class="cursor-pointer"
          @filter="onFiltered"
          @click="push(`/modrinth/${mod.project_id}`)"
          @search="push(`/modrinth?query=${mod.title}`)"
        />

        <div class="min-h-14 w-full p-1" />
      </div>
      <v-skeleton-loader
        v-if="refreshing && projects.length === 0"
        class="flex flex-col gap-3 overflow-auto"
        type="list-item-avatar-three-line, list-item-avatar-three-line, list-item-avatar-three-line, list-item-avatar-three-line, list-item-avatar-three-line, list-item-avatar-three-line"
      />
      <ErrorView
        class="h-full"
        :error="searchError"
        @refresh="refresh"
      />
    </div>
    <div class="flex flex-col overflow-y-auto md:hidden lg:col-span-3 lg:flex">
      <ModrinthCategories
        class="overflow-auto"
        :loading="refreshingTag"
        :environments="environments"
        :categories="categories.filter(c => c.project_type === projectType)"
        :game-versions="gameVersions"
        :licenses="licenses"
        :loaders="filteredModloaders"
        :environment="environment"
        :mod-loader="modLoader"
        :game-version="gameVersion"
        :license="license"
        :category="category"
        :error="tagError"
        @select:modLoader="_modLoader = _modLoader === $event ? '' : $event"
        @select:gameVersion="_gameVersion = _gameVersion === $event ? '' : $event"
        @select:license="_license = _license === $event ? '' : $event"
        @select:category="selectCategory"
        @select:environment="_environment = _environment === $event ? '' : $event"
      />
    </div>
  </div>
</template>

<script lang="ts" setup>
import ModrinthCategories from './ModrinthCategories.vue'
import ModrinthModCard from './ModrinthModCard.vue'

import ErrorView from '@/components/ErrorView.vue'
import { usePresence } from '@/composables/presence'
import { useModrinth, useModrinthTags } from '../composables/modrinth'

const props = withDefaults(defineProps<{
  query: string
  gameVersion: string
  license: string
  category: string[]
  modLoader: string
  environment: string
  projectType: string
  sortBy: string
  page: number
  from: string
}>(), {
  query: () => '',
  gameVersion: () => '',
  license: () => '',
  category: () => [] as string[],
  modLoader: () => '',
  environment: () => '',
  projectType: () => 'modpack',
  sortBy: () => '',
  page: () => 1,
  from: () => '',
})

const { t } = useI18n()
const { refreshing: refreshingTag, categories, modLoaders, environments, gameVersions, licenses, error: tagError } = useModrinthTags()
const {
  error: searchError,
  refresh, query: _query, category: _category, gameVersion: _gameVersion, license: _license, modLoader: _modLoader, environment: _environment, projectType: _projectType,
  sortBy: _sortBy, page: _page, projectTypes,
  refreshing, sortOptions, projects, pageSize, pageCount, pageSizeOptions,
} = useModrinth(props)
const { push } = useRouter()
const filteredModloaders = computed(() => modLoaders.value.filter(v => v.supported_project_types.indexOf(props.projectType) !== -1))
const keyword = ref(props.query)
watch(() => props.query, () => {
  keyword.value = props.query
})
const onFiltered = (tag: string) => {
  if (categories.value.find(c => c.name === tag)) {
    selectCategory(tag)
  } else if (modLoaders.value.find(l => l.name === tag)) {
    _modLoader.value = tag
  }
}
const selectCategory = (cat: string) => {
  if (_category.value.indexOf(cat) === -1) {
    _category.value = [..._category.value, cat]
  } else {
    _category.value = _category.value.filter(v => v !== cat)
  }
}
onMounted(() => {
  refresh()
})

usePresence(computed(() => t('presence.modrinth')))
</script>

<style>
.modrinth .theme--.v-text-field>.v-input__control>.v-input__slot:before {
  border: none;
}

.modrinth .v-text-field>.v-input__control>.v-input__slot:before {
  border: none;
  border-width: 0px;
}
</style>
