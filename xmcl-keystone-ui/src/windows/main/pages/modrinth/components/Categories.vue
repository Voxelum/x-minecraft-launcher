<template>
  <v-card
    v-if="!loading"
    class="p-4 rounded-lg flex flex-col h-[fit-content]"
  >
    <span class="list-title">{{ $t('modrinth.categories.name') }}</span>
    <span
      v-for="cat in categories"
      :key="cat"
      class="item"
      :class="{ selected: cat === category }"
      @click="$emit('select:category', cat)"
    >{{ $t(`modrinth.categories.${cat}`) }}</span>
    <span class="list-title">{{ $t('modrinth.modLoaders.name') }}</span>
    <span
      v-for="l in loaders"
      :key="l"
      class="item"
      :class="{ selected: l === modLoader }"
      @click="$emit('select:modLoader', l)"
    >{{ $t(`modrinth.categories.${l}`) }}</span>
    <span class="list-title">{{ $t('modrinth.environments.name') }}</span>
    <span
      v-for="env in environments"
      :key="env"
      :class="{ selected: env === environment }"
      class="item"
      @click="$emit('select:environment', env)"
    >{{ $t(`modrinth.environments.${env}`) }}</span>
    <span class="list-title">{{ $t('modrinth.gameVersions.name') }}</span>
    <v-select
      solo
      flat
      clearable
      :label="$t('modrinth.gameVersions.name')"
      :items="gameVersions"
      hide-details
      :value="gameVersion"
      @input="$emit('select:gameVersion', $event)"
    />
    <span class="list-title">{{ $t('modrinth.licenses.name') }}</span>
    <v-select
      solo
      flat
      clearable
      :label=" $t('modrinth.licenses.name') "
      :items="licenses"
      :item-text="v => v.name"
      :item-value="v => v.short"
      :value="license"
      hide-details
      @input="$emit('select:license', $event)"
    />
  </v-card>
  <v-card v-else>
    <RefreshingTile />
  </v-card>
</template>
<script lang="ts">
import { defineComponent } from '@vue/composition-api'
import { required } from '/@/util/props'
import RefreshingTile from '/@/components/RefreshingTile.vue'

export default defineComponent({
  components: { RefreshingTile },
  props: {
    loading: required<boolean>(Boolean),
    categories: required<string[]>(Array),
    category: required(String),
    loaders: required<string[]>(Array),
    modLoader: required(String),
    environments: required<string[]>(Array),
    environment: required(String),
    gameVersions: required<string[]>(Array),
    gameVersion: required(String),
    licenses: required<string[]>(Array),
    license: required(String),
  },
})
</script>

<style scoped>
.item {
  @apply rounded-lg ml-2 hover:bg-[rgba(255,255,255,0.2)] cursor-pointer p-1 pl-3;
}

.list-title {
  @apply font-bold text-lg py-1;
}

.selected {
  @apply bg-[rgba(255,255,255,0.2)];
}

</style>
