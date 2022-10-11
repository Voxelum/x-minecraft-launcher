<template>
  <v-card
    v-if="!loading"
    outlined
    class="p-4 rounded-lg flex flex-col h-[fit-content]"
  >
    <span class="list-title">{{ t('modrinth.categories.name') }}</span>
    <span
      v-for="cat in categories"
      :key="cat.name"
      class="item"
      @click="emit('select:category', cat.name)"
    >
      <v-checkbox
        :input-value="category.indexOf(cat.name) !== -1"
        hide-details
        class="mt-0 pt-0"
      />
      <div
        class="w-5 max-w-5 flex justify-center"
        v-html="cat.icon"
      />
      <div>
        {{ ts(`modrinth.categories.${cat.name}`, cat.name) }}
      </div>
    </span>
    <span class="list-title">{{ t('modrinth.modLoaders.name') }}</span>
    <span
      v-for="l in loaders"
      :key="l.name"
      class="item"
      @click="emit('select:modLoader', l.name)"
    >
      <v-checkbox
        :input-value="l.name === modLoader"
        hide-details
        class="mt-0 pt-0"
      />
      <div
        class="w-5 max-w-5 flex justify-center"
        v-html="l.icon"
      />
      {{ ts(`modrinth.categories.${l.name}`,l.name) }}
    </span>
    <span class="list-title">{{ t('modrinth.environments.name') }}</span>
    <span
      v-for="env in environments"
      :key="env"
      class="item"
      @click="emit('select:environment', env)"
    >
      <v-checkbox
        :input-value="env === environment"
        hide-details
        class="mt-0 pt-0"
      />
      {{ ts(`modrinth.environments.${env}`, env) }}
    </span>
    <span class="list-title">{{ t('modrinth.gameVersions.name') }}</span>
    <v-select
      solo
      flat
      clearable
      :label="t('modrinth.gameVersions.name')"
      :items="gameVersions.map(v => v.version)"
      hide-details
      :value="gameVersion"
      @input="emit('select:gameVersion', $event == null ? '' : $event)"
    />
    <span class="list-title">{{ t('modrinth.licenses.name') }}</span>
    <v-select
      solo
      flat
      clearable
      :label="t('modrinth.licenses.name') "
      :items="licenses"
      :item-text="
        // @ts-expect-error
        v => v.name"
      :item-value="
        // @ts-expect-error
        v => v.short"
      :value="license"
      hide-details
      @input="emit('select:license', $event)"
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
<script lang="ts" setup>
import { Category, GameVersion, License, Loader } from '@xmcl/modrinth'
import { useI18n } from '/@/composables'

const { ts, t } = useI18n()
const emit = defineEmits(['select:license', 'select:gameVersion', 'select:environment', 'select:modLoader', 'select:category'])
defineProps<{
  loading:boolean
  categories:Category[]
  category:string[]
  loaders:Loader[]
  modLoader:String
  environments:string[]
  environment:String
  gameVersions:GameVersion[]
  gameVersion:String
  licenses:License[]
  license:String
}>()
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
