<template>
  <div class="flex gap-3 p-4 overflow-auto mb-1 curseforge">
    <v-progress-linear
      class="absolute top-0 z-10 m-0 p-0 left-0"
      :active="loading"
      height="3"
      :indeterminate="true"
    />
    <div class="flex flex-col gap-3 overflow-auto">
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
        <v-pagination
          v-model="currentPage"
          :disabled="loading"
          :length="pages"
          :total-visible="5"
        />
      </v-card>
      <div
        v-if="!loading"
        class="flex flex-col gap-3 overflow-auto flex-shrink flex-grow-0"
      >
        <v-card
          v-for="proj in projects"
          :key="proj.id"
          v-ripple
          :disabled="loading"
          hover
          outlined
          exact
          push
          :to="`/curseforge/${currentType}/${proj.id}?from=${from || ''}`"
          class="flex"
        >
          <v-img
            :src="proj.logo.url"
            max-width="120"
            class="rounded"
          >
            <template #placeholder>
              <v-layout
                fill-height
                align-center
                justify-center
                ma-0
              >
                <v-progress-circular
                  indeterminate
                  color="grey lighten-5"
                />
              </v-layout>
            </template>
          </v-img>
          <div class="flex-grow">
            <v-card-title>
              {{ proj.name }}
            </v-card-title>
            <v-card-subtitle class="flex flex-wrap gap-4">
              <div class="text-current">
                <v-icon
                  left
                  small
                >
                  person
                </v-icon>
                {{ proj.authors[0].name }}
              </div>
              <div>
                <v-icon
                  left
                  small
                >
                  event
                </v-icon>
                {{ getLocalDateString(proj.dateModified || proj.dateCreated) }}
              </div>
              <div>
                <v-icon
                  left
                  small
                >
                  file_download
                </v-icon>
                {{ getExpectedSize(proj.downloadCount, '') }}
              </div>
            </v-card-subtitle>
            <v-card-text>{{ proj.summary }}</v-card-text>
          </div>
          <div
            class="p-4 flex flex-wrap gap-2 justify-start content-start"
            @click.stop.prevent
          >
            <v-chip
              v-for="cat of dedup(proj.categories, (v) => v.id)"
              :key="cat.id"
              label
              outlined
              @click="categoryId = categoryId === cat.id ? undefined : cat.id"
            >
              <v-tooltip top>
                <template #activator="{ on }">
                  <v-avatar>
                    <img
                      :src="cat.iconUrl"
                      style="max-height:30px; max-width: 30px"
                      v-on="on"
                    >
                  </v-avatar>
                </template>
                {{ cat.name }}
              </v-tooltip>
            </v-chip>
          </div>
        </v-card>
      </div>
      <v-skeleton-loader
        v-else
        class="flex flex-col gap-3 overflow-auto"
        type="list-item-avatar-three-line, list-item-avatar-three-line, list-item-avatar-three-line, list-item-avatar-three-line, list-item-avatar-three-line, list-item-avatar-three-line"
      />
    </div>
    <div class="flex flex-col overflow-auto md:hidden lg:flex min-w-[20%]">
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

import { getLocalDateString } from '@/util/date'
import { dedup } from '@/util/dedup'
import { getExpectedSize } from '@/util/size'

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
const { versions, refresh, refreshing } = useMinecraftVersions()
const mcVersions = computed(() => versions.value.filter(v => v.type === 'release').map(v => v.id))

onMounted(refresh)

const {
  currentCategory,
  currentKeyword,
  currentPage,
  currentType,
  currentVersion,
  categoryId,
  loading,
  pages,
  projects,
} = useCurseforge(props)

</script>
