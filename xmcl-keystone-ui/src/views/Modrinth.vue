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
          v-model="page"
          :length="pageCount"
          color="success"
          :disabled="refreshing"
          :total-visible="12"
        />
      </div>
      <v-card
        class="hide-underline flex flex-shrink flex-grow-0 py-1"
        outlined
      >
        <span class="min-w-36 flex flex-1 flex-shrink items-center justify-center">
          <v-select
            v-model="projectType"
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
          @keypress.enter="query = keyword"
        />
        <v-select
          v-model="sortBy"
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
        @select:modLoader="modLoader = modLoader === $event ? '' : $event"
        @select:gameVersion="gameVersion = gameVersion === $event ? '' : $event"
        @select:license="license = license === $event ? '' : $event"
        @select:category="selectCategory"
        @select:environment="environment = environment === $event ? '' : $event"
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

import { useVModels } from '@vueuse/core'

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

const { replace, currentRoute } = useRouter()
const { query, gameVersion, modLoader, category, environment, license } = useVModels(props, (name, val) => {
  switch (name) {
    case 'update:query':
      replace({ query: { ...currentRoute.query, query: val, page: '1' } })
      break
    case 'update:gameVersion':
      replace({ query: { ...currentRoute.query, gameVersion: val, page: '1' } })
      break
    case 'update:license':
      replace({ query: { ...currentRoute.query, license: val, page: '1' } })
      break
    case 'update:category':
      replace({ query: { ...currentRoute.query, category: val, page: '1' } })
      break
    case 'update:modLoader':
      replace({ query: { ...currentRoute.query, modLoader: val, page: '1' } })
      break
    case 'update:environment':
      replace({ query: { ...currentRoute.query, environment: val, page: '1' } })
      break
    case 'update:projectType':
      replace({ query: { ...currentRoute.query, projectType: val, page: '1' } })
      break
    case 'update:sortBy':
      replace({ query: { ...currentRoute.query, sortBy: val, page: '1' } })
      break
    case 'update:page':
      replace({ query: { ...currentRoute.query, page: val.toString() } })
      break
  }
})
const { t } = useI18n()
const { refreshing: refreshingTag, categories, modLoaders, environments, gameVersions, licenses, error: tagError } = useModrinthTags()
const {
  error: searchError,
  refresh,
  projectTypes,
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
    modLoader.value = tag
  }
}
const selectCategory = (cat: string) => {
  if (category.value.indexOf(cat) === -1) {
    category.value = [...category.value, cat]
  } else {
    category.value = category.value.filter(v => v !== cat)
  }
}
onMounted(() => {
  refresh()
})

usePresence(computed(() => t('presence.modrinth')))
</script>
