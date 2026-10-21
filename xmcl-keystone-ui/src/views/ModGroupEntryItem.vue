<template>
  <v-list-item
    link
    v-context-menu="getContextMenu"
    draggable
    :style="cardStyle"
    class="non-moveable mod-group-card flex-1 flex-grow-0 transition-all mx-2 my-1.5 rounded-xl border"
    :class="{ expanded, 'mod-group--dragged-over': isDraggedOver }"
    :title="displayName"
    :subtitle="!dense ? countLabel(items.length) : undefined"
    :aria-label="displayName"
    :aria-expanded="expanded"
    @dragover.prevent="onDragOver"
    @dragenter="isDraggedOver = true"
    @dragleave="isDraggedOver = false"
    @drop="onDrop"
    @click="emit('expand', expanded)"
  >
    <template #prepend>
      <!-- Sleek Glowing Color Pill Indicator -->
      <div
        v-if="color"
        class="w-1 h-5 rounded-full mr-2.5 shrink-0 transition-all"
        :style="{
          background: color,
          boxShadow: `0 0 10px ${color}88`,
        }"
      />

      <v-avatar
        variant="text"
        rounded="lg"
        :size="dense ? 30 : 38"
        class="mod-group-entry__avatar"
        :style="avatarStyle"
      >
        <template v-if="icon">
          <v-icon :size="dense ? 18 : 20" :color="color || 'primary'">
            {{ icon }}
          </v-icon>
        </template>
        <div v-else-if="avatars.length > 0" class="mod-group-entry__avatar-grid">
          <v-img
            v-for="(avatar, index) in avatars.slice(0, 4)"
            :key="`avatar-${avatar}-${index}`"
            class="mod-group-entry__avatar-image"
            cover
            :src="avatar"
          />
        </div>
        <div
          v-else
          class="w-full h-full flex items-center justify-center"
        >
          <v-icon :size="dense ? 18 : 20" :color="color || undefined">
            folder
          </v-icon>
        </div>
      </v-avatar>
    </template>

    <template #append>
      <div class="flex items-center gap-1.5 select-none" @click.stop>
        <v-chip
          v-if="dense"
          size="x-small"
          variant="tonal"
          :color="color ? undefined : 'surface-variant'"
          :style="color ? { color: color, background: `${color}18` } : undefined"
          class="font-medium px-1.5 text-[11px]"
        >
          {{ items.length }}
        </v-chip>
        <v-icon
          v-if="pinned"
          size="16"
          color="primary"
          v-shared-tooltip="() => t('mod.pinned')"
          class="rotate-45 opacity-80"
        >
          push_pin
        </v-icon>
        <div
          class="w-7 h-7 rounded-lg flex items-center justify-center transition-all cursor-pointer"
          :style="{
            background: expanded
              ? (color ? `${color}25` : 'rgba(var(--v-theme-primary), 0.18)')
              : 'rgba(255, 255, 255, 0.04)',
          }"
          @click="emit('expand', expanded)"
        >
          <v-icon :size="18" :color="color || (expanded ? 'primary' : undefined)">
            {{ expanded ? 'folder_open' : 'folder' }}
          </v-icon>
        </div>
      </div>
    </template>
  </v-list-item>
</template>

<script setup lang="ts">
import { ContextMenuItem } from '@/composables/contextMenu'
import { useDialog } from '@/composables/dialog'
import { getGroupDisplayName } from '@/composables/modGroup'
import { vContextMenu } from '@/directives/contextMenu'
import { vSharedTooltip } from '@/directives/sharedTooltip'
import { ProjectEntry } from '@/util/search'

const props = withDefaults(defineProps<{
  items: ProjectEntry[]
  name: string
  color?: string
  icon?: string
  pinned?: boolean
  expanded?: boolean
  dense?: boolean
  height?: number
  countLabel?: (count: number) => string
  toggleAll?: boolean
  groupRules?: boolean
}>(), {
  countLabel: undefined,
  toggleAll: true,
  groupRules: true,
  color: '',
  icon: '',
  pinned: false,
})

const { t, locale } = useI18n()

const displayName = computed(() => getGroupDisplayName(props.name, t, locale.value))

const cardStyle = computed(() => ({
  minHeight: props.height ? `${props.height}px` : undefined,
  maxHeight: props.height ? `${props.height}px` : undefined,
  background: props.color
    ? `linear-gradient(90deg, ${props.color}15 0%, ${props.color}06 40%, rgba(255, 255, 255, 0.02) 100%)`
    : 'rgba(255, 255, 255, 0.02)',
  borderColor: props.color
    ? `${props.color}35`
    : 'rgba(255, 255, 255, 0.06)',
}))

const avatarStyle = computed(() => ({
  background: props.color
    ? `${props.color}22`
    : 'rgba(255, 255, 255, 0.05)',
  border: `1px solid ${props.color ? `${props.color}40` : 'rgba(255, 255, 255, 0.08)'}`,
}))

const avatars = computed(() => props.items.map((item) => item.icon).filter((icon): icon is string => !!icon))

const emit = defineEmits(['expand', 'setting', 'ungroup', 'enable-all', 'disable-all', 'apply-group-rules', 'save-group-rules', 'drop-mod', 'toggle-pin'])

const isDraggedOver = ref(false)

function onDragOver(e: DragEvent) {
  e.preventDefault()
  if (e.dataTransfer) {
    e.dataTransfer.dropEffect = 'move'
  }
}

function onDrop(e: DragEvent) {
  isDraggedOver.value = false
  const fileName = e.dataTransfer?.getData('fileName')
  if (fileName) {
    e.preventDefault()
    e.stopPropagation()
    emit('drop-mod', { fileName, groupName: props.name })
  }
}

const countLabel = (count: number) => props.countLabel?.(count) ?? t('mod.mods', { count })

const { show } = useDialog('folder-setting')
const mutableState = reactive({
  name: props.name,
  color: props.color || '',
  noColor: false,
  icon: props.icon || '',
  hasIcon: true,
  pinned: !!props.pinned,
  hasPinned: true,
})
watch([() => props.name, () => props.color, () => props.icon, () => props.pinned], ([name, color, icon, pinned]) => {
  mutableState.name = name
  mutableState.color = color || ''
  mutableState.icon = icon || ''
  mutableState.pinned = !!pinned
})
watch(
  mutableState,
  (state) => {
    emit('setting', state)
  },
  { deep: true },
)
function getContextMenu() {
  const allEnabled = props.items.every((item) => item.installed?.[0]?.enabled)
  const allDisabled = props.items.every((item) => !item.installed?.[0]?.enabled)

  const items: ContextMenuItem[] = [
    {
      icon: 'push_pin',
      text: props.pinned ? t('mod.unpinGroup') : t('mod.pinGroup'),
      section: 'config',
      onClick: () => {
        emit('toggle-pin')
      },
    },
    {
      icon: 'tune',
      text: t('instances.folderSetting'),
      section: 'config',
      onClick: () => {
        show(mutableState)
      },
    },
  ]

  // Add enable/disable options if not all are in the same state
  if (props.toggleAll && !allEnabled) {
    items.push({
      icon: 'flash_on',
      text: t('mod.enableAll'),
      section: 'action',
      onClick: () => {
        emit('enable-all')
      },
    })
  }

  if (props.toggleAll && !allDisabled) {
    items.push({
      icon: 'flash_off',
      text: t('mod.disableAll'),
      section: 'action',
      onClick: () => {
        emit('disable-all')
      },
    })
  }

  items.push({
    icon: 'label_off',
    text: t('mod.ungroup'),
    section: 'group',
    onClick: () => {
      emit('ungroup')
    },
  })

  if (props.groupRules) {
    items.push({
      icon: 'bookmarks',
      text: t('mod.applyGroupRules'),
      section: 'rules',
      onClick: () => {
        emit('apply-group-rules')
      },
    })

    items.push({
      icon: 'book',
      text: t('mod.syncGroupRules'),
      section: 'rules',
      onClick: () => {
        emit('save-group-rules')
      },
    })
  }

  return items
}
</script>

<style lang="css" scoped>
.mod-group-card {
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}
.mod-group-card:hover {
  background: rgba(255, 255, 255, 0.05) !important;
  border-color: rgba(255, 255, 255, 0.12) !important;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
}

.mod-group-entry__avatar-grid {
  display: grid;
  width: 100%;
  height: 100%;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  grid-template-rows: repeat(2, minmax(0, 1fr));
  gap: 2px;
  padding: 2px;
}

.mod-group-entry__avatar-image {
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  border-radius: 4px;
}

.expanded {
  border-bottom-left-radius: 6px;
  border-bottom-right-radius: 6px;
}
.mod-group--dragged-over {
  border: 1px dashed rgba(var(--v-theme-primary), 0.8) !important;
  background: rgba(var(--v-theme-primary), 0.12) !important;
  border-radius: 12px !important;
  transform: scale(0.99);
}
</style>
