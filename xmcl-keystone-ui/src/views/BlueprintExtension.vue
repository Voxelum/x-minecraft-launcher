<template>
  <div class="z-5 flex flex-shrink flex-grow-0 items-center gap-2 mb-3">
    <AvatarItemList :items="extensionItems" />
    <v-spacer />
    <v-text-field
      v-model="keyword"
      :label="t('blueprint.searchLocal')"
      prepend-inner-icon="search"
      hide-details
      density="compact"
      variant="solo"
      class="max-w-100"
      data-testid="blueprint-search"
    />
  </div>
</template>

<script lang="ts" setup>
import AvatarItemList from '@/components/AvatarItemList.vue'
import { kInstance } from '@/composables/instance'
import { kInstanceBlueprints } from '@/composables/instanceBlueprints'
import { useQuery } from '@/composables/query'
import { getExtensionItemsFromRuntime } from '@/util/extensionItems'
import { injection } from '@/util/inject'

const { runtime } = injection(kInstance)
const { blueprints } = injection(kInstanceBlueprints)
const keyword = useQuery('keyword')
const { t } = useI18n()

const extensionItems = computed(() => [
  {
    icon: 'view_in_ar',
    title: t('blueprint.name', { count: 2 }),
    text: t('blueprint.count', { count: blueprints.value.length }),
  },
  ...getExtensionItemsFromRuntime(runtime.value),
])
</script>
