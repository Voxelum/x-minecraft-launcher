<template>
  <v-menu
    v-model="data.opened"
    bottom
    :close-on-content-click="false"
    :disabled="disabled"
    style="background-color: #303030; overflow-y: hidden;"
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
    />
    <v-list
      v-else
      class="h-full flex flex-col overflow-auto p-0"
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
      <virtual-list
        class="h-full overflow-y-auto max-h-[300px]"
        :data-sources="filteredItems"
        :data-key="'name'"
        :data-component="VersionMenuListTile"
        :keep="16"
        :extra-props="{ select: onSelect }"
      />
      <v-list-item v-if="filteredItems.length === 0">
        {{ emptyText }}
      </v-list-item>
    </v-list>
  </v-menu>
</template>

<script lang=ts setup>
import { VersionMenuItem } from '../composables/versionList'
import VersionMenuListTile from './VersionMenuListTile.vue'

const props = defineProps<{
  items: VersionMenuItem[]
  refreshing?: boolean
  disabled?: boolean
  isClearable?: boolean
  clearText?: string
  emptyText?: string
  hasSnapshot?: boolean
  snapshot?: boolean
  snapshotTooltip?: string
}>()

const emit = defineEmits(['update:snapshot', 'select'])
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
