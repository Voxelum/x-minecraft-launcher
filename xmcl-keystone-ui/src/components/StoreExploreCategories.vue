<template>
  <v-card
    class="flex overflow-auto rounded-lg"
  >
    <Transition
      name="fade-transition"
      mode="out-in"
    >
      <v-card
        v-if="display"
        class="z-8 absolute left-0 top-0 grid h-full gap-2 rounded-lg p-2"
        :style="{ 'grid-template-rows': `repeat(${Math.min(display.length, 4)}, minmax(0, 1fr))` }"
      >
        <v-img
          v-for="d of display.slice(0, 4)"
          :key="d"
          class="min-h-40"
          :src="d"
        />
      </v-card>
    </Transition>
    <v-skeleton-loader
      v-if="loading && groups.length === 0"
      class="flex flex-col gap-3 overflow-auto"
      type="list-item-avatar-two-line, list-item-avatar-two-line, list-item-avatar-two-line, list-item-avatar-two-line, list-item-avatar-two-line, list-item-avatar-two-line"
    />
    <ErrorView
      v-if="groups.length === 0 && error"
      :error="error"
      @refresh="emit('refresh')"
    />
    <div
      v-else
      class="invisible-scroll flex max-h-full w-full flex-grow-0 flex-col overflow-auto p-4"
    >
      <template
        v-for="g of groups"
      >
        <span
          :key="g.text"
          class="list-title"
        >{{ g.text }}</span>
        <template v-if="g.type === 'checkbox'">
          <span
            v-for="cat in g.categories"
            :key="g.text + cat.text"
            class="item"
            @click="emit('select', { category: cat.id, group: g.id })"
          >
            <v-checkbox
              :input-value="selected.indexOf(cat.id) !== -1"
              hide-details
              class="mt-0 pt-0"
            />
            <div
              v-if="cat.iconHTML"
              class="max-w-5 flex w-5 justify-center"
              v-html="cat.iconHTML"
            />
            <v-img
              v-else-if="cat.icon"
              :src="cat.icon"
              class="max-w-5"
            />
            <div>
              {{ cat.text }}
            </div>
          </span>
        </template>
        <div
          v-else-if="g.type === 'buttons'"
          :key="g.text + 'toggle'"
          class="py-2"
        >
          <v-btn-toggle
            :value="g.categories.findIndex(v => selected.includes(v.id))"
            background-color="transparent"
            class="px-1"
            @change="emit('select', { category: g.categories.at($event)?.id ?? '', group: g.id })"
          >
            <v-btn
              v-for="tag in g.categories"
              :key="tag.id"
              v-shared-tooltip="tag.text"
              small
              outlined
            >
              <v-icon
                class="material-icons-outlined"
                small
              >
                {{ tag.icon }}
              </v-icon>
            </v-btn>
          </v-btn-toggle>
        </div>
        <v-combobox
          v-else
          :key="g.text + 'select'"
          class="flex-grow-0"
          solo
          flat
          clearable
          :label="g.text"
          :items="g.categories"
          hide-details
          :item-value="
            // @ts-ignore
            (v) => v.id"
          :value="g.categories.find(v => selected.includes(v.id))"
          @input="emit('select', { category: $event?.id || '', group: g.id })"
        />
      </template>
    </div>
  </v-card>
</template>
<script lang="ts" setup>
import ErrorView from '@/components/ErrorView.vue'
import { vSharedTooltip } from '@/directives/sharedTooltip'

export interface Category {
  iconHTML?: string
  icon?: string
  text: string
  id: string
}

export interface ExploreCategoryGroup {
  type: 'menu' | 'checkbox' | 'buttons'
  text: string
  id: string
  categories: Category[]
}

const emit = defineEmits<{
  (event: 'select', item: { group: string; category: string }): void
  (event: 'refresh'): void
}>()

defineProps<{
  display?: string[]
  groups: Array<ExploreCategoryGroup>
  selected: string[]
  loading: boolean
  error: any
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
