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
        <v-text-field
          v-model="keywordBuffer"
          v-focus-on-search="() => true"
          color="green"
          append-icon="search"
          solo
          flat
          hide-details
          :placeholder="$t('curseforge.search')"
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
          <div
            class="flex items-center justify-center max-w-24"
          >
            <v-img
              :src="proj.attachments[0] ? proj.attachments[0].thumbnailUrl : ''"
              max-width="100"
              contain
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
          </div>
          <v-divider
            vertical
            style="padding-left: 10px;"
            inset
          />
          <div class="flex-grow">
            <v-card-title>
              <span style="font-weight: bold;">{{ proj.name }}</span>
              <span style="padding-left: 3px;">by {{ proj.authors[0].name }}</span>
              <div style="color: grey; padding-left: 5px;">
                <!-- {{ proj.downloadCount }} -->
                {{ new Date(proj.dateModified || proj.dateCreated).toLocaleDateString() }}
              </div>
            </v-card-title>
            <v-card-text>{{ proj.summary }}</v-card-text>
          </div>
          <div
            class="p-4 flex flex-wrap gap-2"
            @click.stop.prevent
          >
            <v-chip
              v-for="cat of dedup(proj.categories, (v) => v.categoryId)"
              :key="cat.categoryId"
              label
              outlined
              @click="categoryId = cat.categoryId"
            >
              <v-tooltip top>
                <template #activator="{ on }">
                  <v-avatar>
                    <img
                      :src="cat.avatarUrl"
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
        @select="currentCategory = $event.toString()"
      />
    </div>
  </div>
</template>

<script lang=ts setup>
import { useI18n } from '/@/composables'
import { dedup } from '/@/util/dedup'
import Categories from './CurseforgeCategories.vue'
import { useCurseforge } from '../composables/curseforge'
import { vFocusOnSearch } from '../directives/focusOnSearch'

interface CurseforgeProps {
  type: string
  page: number
  keyword: string
  category: string
  sort: string
  gameVersion: string
  from: string
}

const props = withDefaults(
  defineProps<CurseforgeProps>(), {
    type: 'mc-mods',
    page: 1,
    keyword: '',
    category: '',
    sort: '',
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

const {
  currentCategory,
  currentKeyword,
  currentPage,
  currentType,
  categoryId,
  loading,
  pages,
  projects,
} = useCurseforge(props)

</script>

<style>
</style>
