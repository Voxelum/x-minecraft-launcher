<template>
  <div class="flex gap-2 p-4 overflow-auto mb-1 modrinth w-full pb-0">
    <v-progress-linear
      class="absolute top-0 z-10 m-0 p-0 left-0"
      :active="refreshing"
      height="3"
      :indeterminate="true"
    />
    <div class="flex flex-col gap-2 overflow-auto">
      <v-card
        class="flex py-1 flex-shrink flex-grow-0"
        outlined
      >
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

      <div class="flex flex-col gap-3 overflow-auto">
        <ModCard
          v-for="mod in mods"
          :key="mod.mod_id"
          v-ripple
          :disabled="refreshing"
          :value="mod"
          hoverable
          class="cursor-pointer"
          @filter="onFiltered"
          @click="push(`/modrinth/${mod.mod_id}`)"
        />
      </div>
    </div>
    <div class="flex flex-col overflow-auto lg:flex md:hidden">
      <Categories
        class="overflow-auto"
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
    const onFiltered = (tag: string) => {
      if (rest.categories.value.indexOf(tag) !== -1) {
        rest.category.value = tag
      } else if (rest.modLoaders.value.indexOf(tag) !== -1) {
        rest.modLoader.value = tag
      }
    }
    onMounted(() => {
      refresh()
      refreshTag()
    })
    return {
      ...rest,
      refresh,
      push,
      onFiltered,
    }
  },
})
</script>

<style>
.modrinth
  .theme--.v-text-field
  > .v-input__control
  > .v-input__slot:before {
  border: none;
}

.modrinth .v-text-field>.v-input__control>.v-input__slot:before {
  border: none;
  border-width: 0px;
}
</style>
