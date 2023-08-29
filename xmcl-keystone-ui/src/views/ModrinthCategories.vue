<template>
  <v-card
    outlined
    class="flex h-[fit-content] flex-col rounded-lg p-4"
  >
    <v-skeleton-loader
      v-if="loading"
      class="flex flex-col gap-3 overflow-auto"
      type="list-item-avatar-two-line, list-item-avatar-two-line, list-item-avatar-two-line, list-item-avatar-two-line, list-item-avatar-two-line, list-item-avatar-two-line"
    />
    <ErrorView
      :error="error"
      @refresh="emit('refresh')"
    />
    <template v-if="!loading && !error">
      <template
        v-for="g of Object.entries(groupedCategories)"
      >
        <span
          :key="g[0]"
          class="list-title"
        >{{ t('modrinth.categories.' + g[0]) }}</span>
        <span
          v-for="cat in g[1]"
          :key="g[0] + cat.name"
          class="item"
          @click="emit('select:category', cat.name)"
        >
          <v-checkbox
            :input-value="category.indexOf(cat.name) !== -1"
            hide-details
            class="mt-0 pt-0"
          />
          <div
            class="max-w-5 flex w-5 justify-center"
            v-html="cat.icon"
          />
          <div>
            {{ t(`modrinth.categories.${cat.name}`, cat.name) }}
          </div>
        </span>
      </template>
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
          class="max-w-5 flex w-5 justify-center"
          v-html="l.icon"
        />
        {{ t(`modrinth.categories.${l.name}`,l.name) }}
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
        {{ t(`modrinth.environments.${env}`, env) }}
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
    </template>
  </v-card>
</template>
<script lang="ts" setup>
import { Category, GameVersion, License, Loader } from '@xmcl/modrinth'
import ErrorView from '@/components/ErrorView.vue'

const { t } = useI18n()
const emit = defineEmits(['select:license', 'select:gameVersion', 'select:environment', 'select:modLoader', 'select:category', 'refresh'])
const prosp = defineProps<{
  loading: boolean
  categories: Category[]
  category: string[]
  loaders: Loader[]
  modLoader: string
  environments: string[]
  environment: string
  gameVersions: GameVersion[]
  gameVersion: string
  licenses: License[]
  license: string
  error: any
}>()

const groupedCategories = computed(() => {
  const group: Record<string, Category[]> = {}
  for (const g of prosp.categories) {
    if (!group[g.header]) group[g.header] = []
    group[g.header].push(g)
  }
  return group
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
