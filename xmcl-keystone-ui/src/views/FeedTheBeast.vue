<template>
  <div class="flex gap-3 p-4 overflow-auto mb-1">
    <v-progress-linear
      class="absolute top-0 z-10 m-0 p-0 left-0"
      :active="refreshing"
      height="3"
      :indeterminate="true"
    />
    <div class="flex flex-col gap-3 overflow-auto">
      <v-card
        class="flex py-1 rounded-lg flex-shrink flex-grow-0"
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
        v-if="!refreshing"
        class="flex flex-col gap-3 overflow-auto flex-shrink flex-grow-0"
      >
        <FeedTheBeastCard
          v-for="modpack of modpacks"
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
const { refresh, refreshing, currentKeyword, modpacks } = useFeedTheBeast(props)

onMounted(refresh)

</script>
