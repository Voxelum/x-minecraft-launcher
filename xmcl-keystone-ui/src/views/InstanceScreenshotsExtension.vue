<template>
  <div
    class="z-5 flex flex-shrink flex-grow-0 items-center justify-between gap-2 px-2"
    :class="{
      'mb-3': !compact,
      'mb-2': compact,
    }"
  >
    <!-- Left: Stats (Count and total size) -->
    <div class="flex items-center gap-2">
      <v-chip
        size="small"
        variant="tonal"
        color="primary"
        class="font-semibold"
      >
        <v-icon start size="16">photo_library</v-icon>
        {{ t('screenshots.countLabel', { count: items.length }) }}
      </v-chip>
      <v-chip
        v-if="items.length > 0"
        size="small"
        variant="text"
        class="text-white/60 font-mono"
      >
        {{ getExpectedSize(totalSize) }}
      </v-chip>
    </div>

    <!-- Center: Search input -->
    <div class="flex-grow max-w-sm mx-2">
      <v-text-field
        v-model="search"
        prepend-inner-icon="search"
        :placeholder="t('screenshots.searchPlaceholder')"
        variant="outlined"
        density="compact"
        hide-details
        clearable
        class="rounded-xl"
      />
    </div>

    <!-- Right: Sort & View Mode Toggles -->
    <div class="flex items-center gap-2 flex-shrink-0">
      <!-- Sort menu -->
      <v-menu location="bottom end">
        <template #activator="{ props: menuProps }">
          <v-btn
            v-bind="menuProps"
            variant="tonal"
            size="small"
            prepend-icon="sort"
            class="rounded-lg text-xs"
          >
            {{ sortLabels[sort] || t('screenshots.sort') }}
          </v-btn>
        </template>
        <v-list density="compact" class="rounded-xl">
          <v-list-item
            v-for="(label, key) in sortLabels"
            :key="key"
            :active="sort === key"
            @click="sort = key as any"
          >
            <v-list-item-title class="text-xs">{{ label }}</v-list-item-title>
          </v-list-item>
        </v-list>
      </v-menu>

      <!-- View mode button group -->
      <div class="flex items-center bg-surface-variant/40 rounded-lg p-0.5 border border-white/5">
        <v-btn
          icon="grid_view"
          variant="text"
          size="x-small"
          :color="viewMode === 'grid' ? 'primary' : 'default'"
          :class="{ 'bg-primary/20': viewMode === 'grid' }"
          v-shared-tooltip="() => t('screenshots.viewGrid')"
          @click="viewMode = 'grid'"
        />
        <v-btn
          icon="view_comfy"
          variant="text"
          size="x-small"
          :color="viewMode === 'gridCompact' ? 'primary' : 'default'"
          :class="{ 'bg-primary/20': viewMode === 'gridCompact' }"
          v-shared-tooltip="() => t('screenshots.viewGridCompact')"
          @click="viewMode = 'gridCompact'"
        />
        <v-btn
          icon="view_list"
          variant="text"
          size="x-small"
          :color="viewMode === 'list' ? 'primary' : 'default'"
          :class="{ 'bg-primary/20': viewMode === 'list' }"
          v-shared-tooltip="() => t('screenshots.viewList')"
          @click="viewMode = 'list'"
        />
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { kCompact } from '@/composables/scrollTop'
import { useScreenshotManagerContext, ScreenshotSortOption } from '@/composables/screenshotManager'
import { getExpectedSize } from '@/util/size'
import { vSharedTooltip } from '@/directives/sharedTooltip'
import { computed, inject, ref } from 'vue'

const { t } = useI18n()
const compact = inject(kCompact, ref(false))
const { items, totalSize, search, sort, viewMode } = useScreenshotManagerContext()

const sortLabels = computed<Record<ScreenshotSortOption, string>>(() => ({
  dateDesc: t('screenshots.sortDateDesc'),
  dateAsc: t('screenshots.sortDateAsc'),
  sizeDesc: t('screenshots.sortSizeDesc'),
  sizeAsc: t('screenshots.sortSizeAsc'),
  nameAsc: t('screenshots.sortNameAsc'),
  nameDesc: t('screenshots.sortNameDesc'),
}))
</script>
