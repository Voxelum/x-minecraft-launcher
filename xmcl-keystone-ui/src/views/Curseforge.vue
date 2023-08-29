<template>
  <div class="curseforge mb-1 flex gap-3 overflow-auto p-4">
    <v-progress-linear
      class="absolute left-0 top-0 z-10 m-0 p-0"
      :active="loading"
      height="3"
      :indeterminate="true"
    />
    <div class="relative flex flex-col gap-3 overflow-auto">
      <div class="hover:(scale-100 opacity-100) absolute bottom-1 z-10 w-full scale-90 transform opacity-60 transition">
        <v-pagination
          v-model="currentPage"
          color="success"
          :disabled="loading"
          :length="pages"
          :total-visible="12"
        />
      </div>
      <v-card
        class="flex flex-shrink flex-grow-0 rounded-lg py-1"
        outlined
      >
        <span class="min-w-36 flex flex-1 flex-shrink items-center justify-center">
          <v-select
            v-model="currentType"
            flat
            solo
            :items="allTypes"
            hide-details
          />
        </span>
        <span class="min-w-36 flex flex-1 flex-shrink items-center justify-center">
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
        class="flex flex-shrink flex-grow-0 flex-col gap-3 overflow-auto px-2"
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
    <div class="flex min-w-[20%] max-w-[20%] select-none flex-col overflow-auto md:hidden lg:flex">
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
