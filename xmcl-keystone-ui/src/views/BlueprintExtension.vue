<template>
  <div class="z-5 flex flex-shrink flex-grow-0 items-center gap-2 mb-3">
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
import { useQuery } from '@/composables/query'

const keyword = useQuery('keyword')
const { t } = useI18n()
</script>
