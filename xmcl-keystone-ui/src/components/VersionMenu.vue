<template>
  <v-menu
    v-model="data.opened"
    bottom
    :close-on-content-click="false"
    :disabled="disabled"
  >
    <template #activator="{ on }">
      <slot :on="on" />
    </template>
    <v-text-field
      v-model="data.filterText"
      color="green"
      append-icon="filter_list"
      :label="t('filter')"
      solo
      class="rounded-none"
      hide-details
    >
      <template #prepend>
        <v-tooltip
          v-if="hasSnapshot"
          top
        >
          <template #activator="{ on }">
            <v-chip
              v-if="hasSnapshot"
              :color="snapshot ? 'primary' : ''"
              icon
              style="margin: 0px; height: 48px; border-radius: 0;"
              @click="emit('update:snapshot', !snapshot)"
            >
              <v-icon v-on="on">
                bug_report
              </v-icon>
            </v-chip>
          </template>
          {{ snapshotTooltip }}
        </v-tooltip>
      </template>
    </v-text-field>
    <v-skeleton-loader
      v-if="refreshing"
      type="list-item-avatar-two-line, list-item-avatar-two-line, list-item-avatar-two-line, list-item-avatar-two-line, list-item-avatar-two-line, list-item-avatar-two-line"
      class="w-100"
    />
    <ErrorView
      v-else-if="error"
      type="error"
      :error="error"
      class="w-100 dark:bg-dark-300 bg-light-500"
      @refresh="emit('refresh')"
    />
    <v-list
      v-else
      class="w-100 flex h-full flex-col overflow-auto p-0"
    >
      <v-list-item
        v-if="isClearable"
        ripple
        @click="onSelect('')"
      >
        <v-list-item-avatar>
          <v-icon>close</v-icon>
        </v-list-item-avatar>
        {{ clearText }}
        <div class="flex-grow" />
      </v-list-item>
      <v-virtual-scroll
        class="box-content h-full max-h-[300px] w-full overflow-y-auto"
        :items="filteredItems"
        :item-height="48"
        :bench="10"
      >
        <template #default="{ item }">
          <v-list-item
            :key="item.name"
            ripple
            @click="onSelect(item.name)"
          >
            {{ item.name }}
            <div class="flex-grow" />
            <v-chip
              v-if="item.tag"
              label
              :color="item.tagColor"
            >
              {{ item.tag }}
            </v-chip>
          </v-list-item>
        </template>
      </v-virtual-scroll>
      <v-list-item v-if="filteredItems.length === 0">
        {{ emptyText }}
      </v-list-item>
    </v-list>
  </v-menu>
</template>

<script lang=ts setup>
import ErrorView from './ErrorView.vue'

export interface VersionItem {
  tag?: string
  tagColor?: string
  name: string
  description?: string
}

const props = defineProps<{
  items: VersionItem[]
  refreshing?: boolean
  disabled?: boolean
  isClearable?: boolean
  clearText?: string
  emptyText?: string
  hasSnapshot?: boolean
  snapshot?: boolean
  snapshotTooltip?: string
  error?: any
}>()

const emit = defineEmits(['update:snapshot', 'select', 'refresh'])
const { t } = useI18n()

const data = reactive({
  opened: false,
  filterText: '',
})

const filteredItems = computed(() => props.items.filter(v => !data.filterText || v.name.toLowerCase().indexOf(data.filterText.toLowerCase()) !== -1 || (v.tag?.toLowerCase().indexOf(data.filterText.toLowerCase()) || -1) !== -1))

const onSelect = (version: string) => {
  emit('select', version)
  data.opened = false
}
watch(computed(() => data.opened), (v) => {
  data.filterText = ''
})
</script>

<style>
.v-input__prepend-outer {
  margin-top: 0px !important;
  margin-right: 0px !important;
  box-shadow: 0 3px 1px -2px rgb(0 0 0 / 20%), 0 2px 2px 0 rgb(0 0 0 / 14%), 0 1px 5px 0 rgb(0 0 0 / 12%);
}
.v-input__prepend-outer {
  margin-bottom: 0px !important;
}
</style>
