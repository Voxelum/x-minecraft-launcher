<template>
  <MarketItem
    :indent="indent"
    :indent-color="indentColor"
    :item="item"
    :selection-mode="selectionMode"
    :selected="selected"
    :has-update="hasUpdate"
    :checked="checked"
    :height="itemHeight"
    :draggable="draggable"
    no-duplicate
    :get-context-menu-items="getContextMenuItems"
    :install="install"
    :dense="dense"
    class="mod-item-card transition-colors"
    :class="{
      'mod-item--disabled': isInstalled && !isEnabled,
      'mod-item--enabled': isInstalled && isEnabled,
    }"
    @click="emit('click', $event)"
    @checked="emit('checked', $event)"
    @drop="onDrop"
  >
    <template
      v-if="!dense && item.installed && (item.installed?.[0]?.tags.length + compatibility.length) > 0"
      #labels
    >
      <ModLabels
        :disabled="item.disabled"
        :compatibility="compatibility"
        :tags="item.installed[0].tags"
        @click-dependency="emit('click-dependency', $event)"
      />
    </template>

    <template #append>
      <div class="flex items-center gap-1 pl-2 select-none" @click.stop>
        <!-- Update Available Badge -->
        <v-chip
          v-if="hasUpdate"
          size="x-small"
          color="primary"
          variant="tonal"
          class="font-semibold text-xs cursor-pointer mr-1"
          v-shared-tooltip="t('mod.hasUpdate')"
        >
          <v-icon start size="13">update</v-icon>
          {{ t('mod.hasUpdate') }}
        </v-chip>

        <!-- Duplicate warning -->
        <v-icon
          v-if="hasDuplicate"
          v-shared-tooltip="props.item.installed.map(v => basename(v.path)).join(', ')"
          size="18"
          color="warning"
          class="mr-1"
        >
          warning
        </v-icon>

        <!-- Toggle Switch for installed mod (when not in multi-selection mode) -->
        <div
          v-if="isInstalled && !selectionMode"
          class="flex items-center mod-toggle-wrapper"
          v-shared-tooltip="isEnabled ? t('shared.disable') : t('shared.enable')"
        >
          <v-switch
            :model-value="isEnabled"
            :disabled="isToggling"
            :loading="isToggling"
            color="primary"
            density="compact"
            hide-details
            inset
            class="mod-item-switch"
            @update:model-value="onToggle"
          />
        </div>

        <!-- Settings Context Menu Trigger -->
        <v-btn
          v-if="isInstalled && !selectionMode"
          icon
          variant="text"
          size="x-small"
          density="comfortable"
          class="mod-settings-btn opacity-60 hover:opacity-100"
          v-shared-tooltip="t('instances.folderSetting')"
          @click.stop="onSettingClick"
        >
          <v-icon size="16">settings</v-icon>
        </v-btn>
      </div>
    </template>
  </MarketItem>
</template>

<script lang="ts" setup>
import MarketItem from '@/components/MarketItem.vue'
import { useService } from '@/composables'
import { kInstance } from '@/composables/instance'
import { kInstanceModsContext } from '@/composables/instanceMods'
import { useModItemContextMenuItems } from '@/composables/modContextMenu'
import { injection } from '@/util/inject'
import { ModFile } from '@/util/mod'
import { ProjectEntry } from '@/util/search'
import { InstanceModsServiceKey } from '@xmcl/runtime-api'
import ModLabels from './ModLabels.vue'
import { ContextMenuItem, useContextMenu } from '@/composables/contextMenu'
import { basename } from '@/util/basename'
import { vSharedTooltip } from '@/directives/sharedTooltip'

const props = defineProps<{
  item: ProjectEntry<ModFile>
  selectionMode: boolean
  checked: boolean
  selected: boolean
  itemHeight: number
  hasUpdate?: boolean
  dense?: boolean
  indent?: boolean
  indentColor?: string
  draggable?: boolean
  getContextMenuItems?: (item: ProjectEntry<ModFile>) => ContextMenuItem[]
  install: (p: ProjectEntry) => Promise<void>
}>()

const emit = defineEmits(['click', 'checked', 'install', 'click-dependency', 'drop-on-mod'])

const { t } = useI18n()
const { open } = useContextMenu()
const { compatibility: compatibilities } = injection(kInstanceModsContext)
const compatibility = computed(() => props.item.installed[0] ? compatibilities.value[props.item.installed[0].modId] ?? [] : [])
const { uninstall } = useService(InstanceModsServiceKey)
const { disable, enable } = injection(kInstanceModsContext)
const { path } = injection(kInstance)

function onDrop(data: any) {
  const sourceFileName = typeof data === 'object' ? data.fileName : undefined
  const sourceId = typeof data === 'object' ? data.id : data
  const targetFileName = props.item.installed?.[0]?.fileName
  if (sourceFileName && targetFileName && sourceFileName !== targetFileName) {
    emit('drop-on-mod', {
      sourceFileName,
      sourceId,
      targetFileName,
      targetId: props.item.id,
      targetTitle: props.item.title,
    })
  }
}

const isInstalled = computed(() => (props.item.installed?.length ?? 0) > 0)
const hasDuplicate = computed(() => (props.item.installed?.length ?? 0) > 1)
const isEnabled = computed(() => props.item.installed?.[0]?.enabled ?? false)

const isToggling = ref(false)
const onToggle = async (val: any) => {
  if (isToggling.value || !props.item.installed || props.item.installed.length === 0) return
  isToggling.value = true
  try {
    const files = props.item.installed.map(i => i.path)
    if (val) {
      await enable({ path: path.value, files })
    } else {
      await disable({ path: path.value, files })
    }
  } finally {
    isToggling.value = false
  }
}

const _getContextMenuItems = useModItemContextMenuItems(computed(() => props.item), () => {
  if (props.item.installed) {
    uninstall({ path: path.value, files: props.item.installed.map(i => i.path) })
  }
}, () => { }, () => {
  if (props.item.installed && props.item.installed.length > 0) {
    if (props.item.installed[0].enabled) {
      disable({ path: path.value, files: props.item.installed.map(i => i.path) })
    } else {
      enable({ path: path.value, files: props.item.installed.map(i => i.path) })
    }
  }
})

const selections = inject('selections', {} as Ref<Record<string, boolean>>)
const getContextMenuItems = () => {
  const items = props.getContextMenuItems?.(props.item)
  if (Object.keys(selections.value).length > 1) return items || []
  return _getContextMenuItems().concat(items ?? [])
}

const onSettingClick = (event: MouseEvent) => {
  const button = event.target as any
  const rect = button.getBoundingClientRect()
  const bottomLeftX = rect.left
  const bottomLeftY = rect.bottom
  open(bottomLeftX, bottomLeftY, getContextMenuItems())
}

const hasLabel = computed(() => !props.dense && props.item.installed && (props.item.installed?.[0]?.tags.length + compatibility.value.length) > 0)
</script>

<style scoped>
.mod-item-card {
  border-radius: 8px;
  margin: 1px 4px;
}
.mod-item--disabled {
  opacity: 0.65;
}
.mod-toggle-wrapper :deep(.v-switch) {
  display: flex;
  align-items: center;
}
.mod-toggle-wrapper :deep(.v-selection-control) {
  min-height: 28px;
}
.mod-settings-btn {
  transition: opacity 0.15s ease;
}
</style>
