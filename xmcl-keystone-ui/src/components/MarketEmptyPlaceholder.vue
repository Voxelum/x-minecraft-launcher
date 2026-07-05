<template>
  <Hint
    :icon="currentView === 'local' ? 'inventory_2' : 'search_off'"
    :text="currentView === 'local' ? t('search.emptyInstalled') : t('search.noResults')"
    class="h-full"
  >
    <v-btn
      v-if="currentView === 'local'"
      color="primary"
      variant="flat"
      prepend-icon="storefront"
      class="mt-2"
      @click="browseMarket"
    >
      {{ t('search.browseMarket') }}
    </v-btn>
  </Hint>
</template>

<script lang="ts" setup>
import Hint from '@/components/Hint.vue'
import { kSearchModel } from '@/composables/search'
import { injection } from '@/util/inject'

const { currentView, source } = injection(kSearchModel)
const { t } = useI18n()

function browseMarket() {
  source.value = 'remote'
}
</script>
