<template>
  <div class="flex gap-3 p-4 overflow-auto mb-1 modrinth">
    <v-progress-linear
      class="absolute top-0 z-10 m-0 p-0 left-0"
      :active="refreshing"
      height="3"
      :indeterminate="true"
    />
    <div class="flex flex-col gap-3">
      <v-card class="flex py-1 rounded-lg flex-shrink flex-grow-0">
        <v-text-field
          v-model="query"
          color="green"
          append-icon="search"
          solo
          flat
          hide-details
          :placeholder="$t('modrinth.searchText')"
          @keypress.enter="refresh"
        />
        <v-select
          v-model="sortBy"
          :item-value="
            // @ts-expect-error
            v => v.name"
          class="max-w-40"
          hide-details
          flat
          :label="$t('modrinth.sort.title')"
          :items="sortOptions"
        />
        <v-select
          v-model="pageSize"
          class="max-w-40"
          :items="pageSizeOptions"
          hide-details
          flat
          :label="$t('modrinth.perPage')"
        />
        <v-pagination
          v-model="page"
          :length="pageCount"
          :total-visible="5"
        />
      </v-card>

      <ModCard
        v-for="mod in mods"
        :key="mod.mod_id"
        v-ripple
        :value="mod"
        hoverable
        class="cursor-pointer"
        @click="push(`/modrinth/${mod.mod_id}`)"
      />
    </div>
    <Categories
      class="max-w-[20%]"
      :loading="refreshingTag"
      :environments="environments"
      :categories="categories"
      :game-versions="gameVersions"
      :licenses="licenses"
      :loaders="modLoaders"
      :environment="environment"
      :mod-loader="modLoader"
      :game-version="gameVersion"
      :license="license"
      :category="category"
      @select:modLoader="modLoader = $event"
      @select:gameVersion="gameVersion = $event"
      @select:license="license = $event"
      @select:category="category = $event"
      @select:environment="environment = $event"
    />
  </div>
</template>

<script lang="ts">
import { defineComponent, onMounted } from '@vue/composition-api'
import { useModrinth } from './modrinth'
import ModCard from './components/ModCard.vue'
import Categories from './components/Categories.vue'
import { useRouter } from '/@/hooks'

export default defineComponent({
  components: { ModCard, Categories },
  setup() {
    const { refresh, refreshTag, ...rest } = useModrinth()
    const { push } = useRouter()
    onMounted(() => {
      refresh()
      refreshTag()
    })
    return {
      ...rest,
      refresh,
      push,
    }
  },
})
</script>

<style>
.modrinth
  .theme--dark.v-text-field
  > .v-input__control
  > .v-input__slot:before {
  border: none;
}
</style>
