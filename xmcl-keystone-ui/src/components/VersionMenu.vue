<template>
  <v-menu
    v-model="data.opened"
    location="bottom"
    :close-on-content-click="false"
    :disabled="disabled"
  >
    <template #activator="{ props: aProps }">
      <slot v-bind="{ props: aProps }" />
    </template>
    <v-text-field
      v-model="data.filterText"
      color="green"
      append-inner-icon="filter_list"
      :label="t('filter')"
      variant="solo-filled"
      autofocus
      class="rounded-none"
      hide-details
    >
      <template #prepend-inner>
        <v-chip
          v-if="hasSnapshot"
          v-shared-tooltip="snapshotTooltip ?? ''"
          :color="snapshot ? 'primary' : ''"
          style="height: 48px;"
          class="mr-1"
          label
          @click="emit('update:snapshot', !snapshot)"
        >
          <v-icon v-bind="props">
            bug_report
          </v-icon>
        </v-chip>
      </template>
      <template #append>
        <v-btn
          icon
          @click="emit ('refresh')"
        >
          <v-icon
          >
            refresh
          </v-icon>
        </v-btn>
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
        <template #prepend>
          <v-avatar>
            <v-icon>close</v-icon>
          </v-avatar>
        </template>
        {{ clearText }}
        <div class="flex-grow" />
      </v-list-item>
      <v-virtual-scroll
        class="box-content h-full max-h-[300px] w-full overflow-y-auto visible-scroll overflow-x-hidden"
        :items="filteredItems"
        :item-height="48"
        :bench="10"
      >
        <template #default="{ item }">
          <v-list-item
            :key="item.name"
            ripple
            :title="item.name"
            @click="onSelect(item.name)"
          >
            <template #subtitle>
              <v-list-item-subtitle :style="{ color: getColorCode(item.tagColor) }">
                {{ item.tag }}
              </v-list-item-subtitle>
            </template>
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
import { vSharedTooltip } from '@/directives/sharedTooltip'
import ErrorView from './ErrorView.vue'
import { useVuetifyColor } from '@/composables/vuetify'

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

const { getColorCode } = useVuetifyColor()
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
