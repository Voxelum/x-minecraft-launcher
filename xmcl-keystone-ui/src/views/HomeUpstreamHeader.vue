<template>
  <v-card
    class="flex flex-col items-center justify-center gap-4 p-4 lg:flex-col"
    outlined
  >
    <v-img
      height="150"
      width="150"
      max-width="150"
      :src="value.icon"
      class="rounded-lg"
    />
    <a
      class="text-2xl font-bold"
      target="browser"
      :href="value.url"
    >
      {{ value.title }}
    </a>
    <span class="text-center">{{ value.description }}</span>
    <span class="flex flex-wrap justify-center gap-2">
      <CategoryChip
        v-for="v of value.categories"
        :key="v.text"
        :item="v"
        outlined
      />
    </span>
    <span class="grid grid-cols-4 items-center justify-center gap-3 lg:grid-cols-2 2xl:grid-cols-4">
      <div
        v-for="(info, i) of value.infos"
        :key="info.name"
        class="relative flex justify-center"
      >
        <InfoHighlight
          :value="info"
        />
        <v-divider
          v-if="i !== value.infos.length - 1 && i % 2 === 0"
          class="absolute -right-1"
          vertical
        />
      </div>
    </span>
    <span>
      <v-btn
        text
        color="primary"
        @click="push(value.store)"
      >
        <v-icon
          left
          class="material-icons-outlined"
        >
          open_in_new
        </v-icon>
        {{ t('store.name') }}
      </v-btn>
    </span>
  </v-card>
</template>
<script lang="ts" setup>
import CategoryChip, { CategoryChipProps } from '@/components/CategoryChip.vue'
import InfoHighlight, { Highlight } from '@/components/InfoHighlight.vue'

export interface UpstreamHeaderProps {
  url: string
  icon: string
  title: string
  description: string
  infos: Highlight[]
  categories: CategoryChipProps[]
  type: 'curseforge' | 'modrinth' | 'ftb'
  store: string
}

const { push } = useRouter()
const { t } = useI18n()
defineProps<{
  value: UpstreamHeaderProps
}>()
</script>
