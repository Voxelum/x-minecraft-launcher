<template>
  <v-list-item
    link
    v-context-menu="getContextMenu"
    draggable
    :style="{
      minHeight: height ? height + 'px' : undefined,
      maxHeight: height ? height + 'px' : undefined,
    }"
    class="non-moveable sidebar-item flex-1 flex-grow-0"
    :class="{ expanded }"
    :title="name"
    :subtitle="!dense ? t('mod.mods', { count: items.length }) : undefined"
    @dragover.prevent
    @click="emit('expand', expanded)"
  >
    <template #prepend>
      <v-avatar
        variant="text"
        rounded
        :size="dense ? 30 : 40"
        class="transition-all duration-300 rounded"
      >
        <div class="grid cols-2 rows-2 gap-[2px] rounded-xl">
          <v-img
            v-for="i in avatars.slice(0, 4)"
            :key="`avatar-${i}`"
            class="rounded-lg"
            :style="{ maxHeight: '20px', maxWidth: '20px', minHeight: '20px', minWidth: '20px' }"
            :src="i"
          />
        </div>
      </v-avatar>
    </template>
    <template #append>
      <v-list-item-action class="mr-0">
        <v-icon>
          {{ expanded ? 'folder_open' : 'folder' }}
        </v-icon>
      </v-list-item-action>
    </template>
  </v-list-item>
</template>

<script setup lang="ts">
import { ContextMenuItem } from '@/composables/contextMenu'
import { useDialog } from '@/composables/dialog'
import { vContextMenu } from '@/directives/contextMenu'
import { ModFile } from '@/util/mod'
import { ProjectEntry } from '@/util/search'

const props = defineProps<{
  items: ProjectEntry<ModFile>[]
  name: string
  color?: string
  expanded?: boolean
  dense?: boolean
  height?: number
}>()

const avatars = computed(() => props.items.map((i) => i.icon).filter((v) => !!v))

const emit = defineEmits(['expand', 'setting', 'ungroup', 'enable-all', 'disable-all', 'apply-group-rules', 'save-group-rules'])

const { t } = useI18n()

const { show } = useDialog('folder-setting')
const mutableState = reactive({
  name: props.name,
  color: props.color,
  noColor: true,
})
watch([() => props.name, () => props.color], ([name, color]) => {
  mutableState.name = name
  mutableState.color = color
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
      icon: 'settings',
      text: t('instances.folderSetting'),
      section: 'config',
      onClick: () => {
        show(mutableState)
      },
    },
  ]

  // Add enable/disable options if not all are in the same state
  if (!allEnabled) {
    items.push({
      icon: 'flash_on',
      text: t('mod.enableAll'),
      section: 'action',
      onClick: () => {
        emit('enable-all')
      },
    })
  }

  if (!allDisabled) {
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

  return items
}
</script>

<style lang="css" scoped>
.expanded {
  border-radius: 0px;
}
</style>
