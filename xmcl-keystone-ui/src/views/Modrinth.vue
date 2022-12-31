<template>
  <div class="gap-2 p-4 overflow-auto mb-1 modrinth w-full pb-0 grid grid-cols-12">
    <v-progress-linear
      class="absolute top-0 z-10 m-0 p-0 left-0"
      :active="refreshing"
      height="3"
      :indeterminate="true"
    />
    <div class="flex flex-col gap-2 overflow-auto lg:col-span-9 md:col-span-12 relative">
      <div class="absolute bottom-3 w-full z-10 transform scale-90 opacity-60 hover:(scale-100 opacity-100) transition">
        <v-pagination
          v-model="_page"
          :length="pageCount"
          color="success"
          :disabled="refreshing"
          :total-visible="12"
        />
      </div>
      <v-card
        class="flex py-1 flex-shrink flex-grow-0"
        outlined
      >
        <span class="flex items-center justify-center flex-shrink flex-1 min-w-36">
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
          :disabled="refreshing"
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
    <div class="flex flex-col overflow-y-auto lg:col-span-3 lg:flex md:hidden">
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
        @refresh="refreshTag"
      />
    </div>
  </div>
</template>

<script lang="ts" setup>
import ModrinthModCard from './ModrinthModCard.vue'
import ModrinthCategories from './ModrinthCategories.vue'

import { useModrinth, useModrinthTags } from '../composables/modrinth'
import ErrorView from '@/components/ErrorView.vue'

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
  projectType: () => 'mod',
  sortBy: () => '',
  page: () => 1,
  from: () => '',
})

const { t } = useI18n()
const { refresh: refreshTag, refreshing: refreshingTag, categories, modLoaders, environments, gameVersions, licenses, error: tagError } = useModrinthTags()
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
  refreshTag()
})
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
