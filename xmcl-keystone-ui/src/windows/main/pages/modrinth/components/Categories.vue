<template>
  <v-card
    v-if="!loading"
    outlined
    class="p-4 rounded-lg flex flex-col h-[fit-content]"
  >
    <span class="list-title">{{ $t('modrinth.categories.name') }}</span>
    <span
      v-for="cat in categories"
      :key="cat.name"
      class="item"
      :class="{ selected: cat.name === category }"
      @click="$emit('select:category', cat.name)"
    >
      <div
        class="w-5 max-w-5 flex justify-center"
        v-html="cat.icon"
      />
      <div>
        {{ $t(`modrinth.categories.${cat.name}`) }}
      </div>
    </span>
    <span class="list-title">{{ $t('modrinth.modLoaders.name') }}</span>
    <span
      v-for="l in loaders"
      :key="l.name"
      class="item"
      :class="{ selected: l.name === modLoader }"
      @click="$emit('select:modLoader', l.name)"
    >
      <div
        class="w-5 max-w-5 flex justify-center"
        v-html="l.icon"
      />
      {{ $t(`modrinth.categories.${l.name}`) }}
    </span>
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
      :items="gameVersions.map(v => v.version)"
      hide-details
      :value="gameVersion"
      @input="$emit('select:gameVersion', $event == null ? '' : $event)"
    />
    <span class="list-title">{{ $t('modrinth.licenses.name') }}</span>
    <v-select
      solo
      flat
      clearable
      :label=" $t('modrinth.licenses.name') "
      :items="licenses"
      :item-text="
        // @ts-expect-error
        v => v.name"
      :item-value="
        // @ts-expect-error
        v => v.short"
      :value="license"
      hide-details
      @input="$emit('select:license', $event)"
    />
  </v-card>
  <v-card
    v-else
    class="p-4 rounded-lg flex flex-col h-[fit-content]"
    outlined
  >
    <v-skeleton-loader
      class="flex flex-col gap-3 overflow-auto"
      type="list-item-avatar-two-line, list-item-avatar-two-line, list-item-avatar-two-line, list-item-avatar-two-line, list-item-avatar-two-line, list-item-avatar-two-line"
    />
  </v-card>
</template>
<script lang="ts">
import { defineComponent } from '@vue/composition-api'
import { required } from '/@/util/props'
import { Category, GameVersion, License, Loader } from '@xmcl/modrinth'

export default defineComponent({
  props: {
    loading: required<boolean>(Boolean),
    categories: required<Category[]>(Array),
    category: required(String),
    loaders: required<Loader[]>(Array),
    modLoader: required(String),
    environments: required<string[]>(Array),
    environment: required(String),
    gameVersions: required<GameVersion[]>(Array),
    gameVersion: required(String),
    licenses: required<License[]>(Array),
    license: required(String),
  },
})
</script>

<style scoped>
.item {
  @apply rounded-lg ml-2 hover:bg-[rgba(255,255,255,0.2)] cursor-pointer p-1 pl-3 inline-flex gap-1 transition transition-all duration-250;
}

.list-title {
  @apply font-bold text-lg py-1;
}

.selected {
  @apply bg-[rgba(255,255,255,0.2)];
}

</style>
