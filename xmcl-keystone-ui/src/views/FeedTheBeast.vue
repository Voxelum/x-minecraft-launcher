<template>
  <div class="mb-1 flex gap-3 overflow-auto p-4">
    <v-progress-linear
      class="absolute left-0 top-0 z-10 m-0 p-0"
      :active="refreshing"
      height="3"
      :indeterminate="true"
    />
    <div class="flex flex-col gap-3 overflow-auto">
      <v-card
        class="flex flex-shrink flex-grow-0 rounded-lg py-1"
        outlined
      >
        <v-text-field
          v-model="keywordBuffer"
          v-focus-on-search="() => true"
          color="green"
          append-icon="search"
          solo
          flat
          clearable
          hide-details
          :placeholder="t('FeedTheBeast.search')"
          @click:clear="currentKeyword = ''"
          @keypress.enter="currentKeyword = keywordBuffer"
        />
      </v-card>
      <div
        v-if="!refreshing && data"
        class="flex flex-shrink flex-grow-0 flex-col gap-3 overflow-auto"
      >
        <FeedTheBeastCard
          v-for="modpack of data.packs"
          :id="modpack"
          :key="modpack"
        />
      </div>
      <v-skeleton-loader
        v-else
        class="flex flex-col gap-3 overflow-auto"
        type="list-item-avatar-three-line, list-item-avatar-three-line, list-item-avatar-three-line, list-item-avatar-three-line, list-item-avatar-three-line, list-item-avatar-three-line"
      />
    </div>
  </div>
</template>

<script lang=ts setup>
import { useFeedTheBeast } from '../composables/ftb'
import FeedTheBeastCard from './FeedTheBeastCard.vue'
import { vFocusOnSearch } from '../directives/focusOnSearch'

const props = defineProps<{ keyword?: string }>()

const { t } = useI18n()
const keywordBuffer = ref('')
const { refreshing, currentKeyword, data } = useFeedTheBeast(props)

</script>
