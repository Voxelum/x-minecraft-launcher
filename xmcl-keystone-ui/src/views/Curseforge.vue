<template>
  <div class="flex gap-3 p-4 overflow-auto mb-1 curseforge">
    <v-progress-linear
      class="absolute top-0 z-10 m-0 p-0 left-0"
      :active="loading"
      height="3"
      :indeterminate="true"
    />
    <div class="flex flex-col gap-3 overflow-auto relative">
      <div class="absolute bottom-1 w-full z-10 transform scale-90 opacity-60 hover:(scale-100 opacity-100) transition">
        <v-pagination
          v-model="currentPage"
          color="success"
          :disabled="loading"
          :length="pages"
          :total-visible="12"
        />
      </div>
      <v-card
        class="flex py-1 rounded-lg flex-shrink flex-grow-0"
        outlined
      >
        <span class="flex items-center justify-center flex-shrink flex-1 min-w-36">
          <v-select
            v-model="currentType"
            flat
            solo
            :items="allTypes"
            hide-details
          />
        </span>
        <span class="flex items-center justify-center flex-shrink flex-1 min-w-36">
          <v-select
            v-model="currentVersion"
            flat
            solo
            clearable
            :items="mcVersions"
            :loading="refreshing"
            :label="t('minecraftVersion.name')"
            hide-details
          />
        </span>
        <v-text-field
          v-model="keywordBuffer"
          v-focus-on-search="() => true"
          color="green"
          append-icon="search"
          solo
          flat
          hide-details
          :placeholder="t('curseforge.search')"
          @keypress.enter="currentKeyword = keywordBuffer"
        />
      </v-card>
      <div
        v-if="!error && projects.length > 0"
        class="flex flex-col gap-3 overflow-auto flex-shrink flex-grow-0 px-2"
      >
        <CurseforgeCard
          v-for="proj in projects"
          :key="proj.id"
          :proj="proj"
          :current-type="currentType"
          :from="from"
          :disabled="false"
          @category="categoryId = categoryId === $event ? undefined : $event"
          @search="currentKeyword = $event"
        />
        <div class="min-h-14 w-full p-1" />
      </div>
      <v-skeleton-loader
        v-if="loading && projects.length === 0"
        class="flex flex-col gap-3 overflow-auto"
        type="list-item-avatar-three-line, list-item-avatar-three-line, list-item-avatar-three-line, list-item-avatar-three-line, list-item-avatar-three-line, list-item-avatar-three-line"
      />
      <ErrorView
        class="h-full"
        :error="error"
        @refresh="refresh"
      />
    </div>
    <div class="flex flex-col overflow-auto md:hidden lg:flex min-w-[20%] max-w-[20%] select-none">
      <Categories
        :type="currentType"
        :selected="currentCategory"
        @select="categoryId = categoryId === $event ? undefined : $event"
      />
    </div>
  </div>
</template>

<script lang=ts setup>
import { FileModLoaderType, ModsSearchSortField } from '@xmcl/curseforge'
import { useCurseforge } from '../composables/curseforge'
import { useMinecraftVersions } from '../composables/version'
import { vFocusOnSearch } from '../directives/focusOnSearch'
import Categories from './CurseforgeCategories.vue'

import ErrorView from '@/components/ErrorView.vue'
import CurseforgeCard from './CurseforgeCard.vue'
import { usePresence } from '@/composables/presence'
import { kLocalVersions } from '@/composables/versionLocal'
import { injection } from '@/util/inject'

interface CurseforgeProps {
  type: string
  page: number
  keyword: string
  category: string
  sortField: ModsSearchSortField
  modLoaderType: FileModLoaderType
  sortOrder: 'asc' | 'desc'
  gameVersion: string
  from: string
}

const props = withDefaults(
  defineProps<CurseforgeProps>(), {
    type: 'mc-mods',
    page: 1,
    keyword: '',
    category: '',
    sortField: 2,
    modLoaderType: 0,
    sortOrder: 'desc',
    gameVersion: '',
    from: '',
  },
)

const { t } = useI18n()
const allTypes = computed(() => ['mc-mods', 'texture-packs', 'worlds', 'modpacks'].map(v => ({
  text: t(`curseforge.${v}.name`),
  value: v,
})))
const keywordBuffer = ref(props.keyword)
watch(() => props.keyword, (newKeyword) => {
  keywordBuffer.value = newKeyword
})
const { versions: local } = injection(kLocalVersions)
const { versions, refreshing } = useMinecraftVersions(local)
const mcVersions = computed(() => versions.value.filter(v => v.type === 'release').map(v => v.id))

const {
  currentCategory,
  currentKeyword,
  currentPage,
  currentType,
  currentVersion,
  categoryId,
  refreshing: loading,
  error,
  pages,
  projects,
  refresh,
} = useCurseforge(props)

usePresence(computed(() => t('presence.curseforge')))

</script>
