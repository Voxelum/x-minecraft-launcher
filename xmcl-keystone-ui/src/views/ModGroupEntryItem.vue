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
    @dragover.prevent
    @click="emit('expand', expanded)"
  >
    <v-list-item-avatar
      :size="dense ? 30 : 40"
      class="transition-all duration-300 rounded"
      large
    >
      <div
        class="grid cols-2 rows-2 gap-[2px] p-[2px] rounded-xl"
      >
        <v-img
          v-for="i in avatars.slice(0, 4)"
          :key="i"
          :style="{ maxHeight: '20px', maxWidth: '20px' }"
          :src="i"
        />
      </div>
    </v-list-item-avatar>
    <v-list-item-content>
      <v-list-item-title>
        {{ name }}
      </v-list-item-title>
      <v-list-item-subtitle v-if="!dense">
        {{ t('mod.mods', { count: items.length }) }}
      </v-list-item-subtitle>
    </v-list-item-content>
    <v-list-item-action class="mr-1.5">
      <v-icon>
        {{ expanded ? 'folder_open' : 'folder' }}
      </v-icon>
    </v-list-item-action>
  </v-list-item>
</template>

<script setup lang="ts">
import { ContextMenuItem } from '@/composables/contextMenu';
import { useDialog } from '@/composables/dialog';
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

const avatars = computed(() => props.items.map(i => i.icon))

const emit = defineEmits(['expand', 'setting', 'ungroup'])

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
watch(mutableState, (state) => {
  emit('setting', state)
}, { deep: true })
function getContextMenu() {
  const items: ContextMenuItem[] = [{
    icon: 'settings',
    text: t('instances.folderSetting'),
    onClick: () => {
      show(mutableState)
    },
  }, {
    icon: 'label_off',
    text: t('mod.ungroup'),
    onClick: () => {
      emit('ungroup')
    },
  }]
  return items
}
</script>

<style lang="css" scoped>
.expanded {
  border-radius: 0px;
}
</style>
