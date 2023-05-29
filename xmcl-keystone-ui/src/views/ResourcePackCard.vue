<template>
  <div class="relative">
    <div
      class="min-h-1 absolute -top-1 left-0 z-10 max-h-1 min-w-full px-2"
    >
      <div
        class="transition-300 min-h-1 max-h-1 min-w-full rounded transition-colors"
        :class="{ 'bg-yellow-400': dragover > 0 }"
      >
        {{ ' ' }}
      </div>
    </div>
    <v-card
      ref="card"
      v-draggable-card
      v-context-menu="contextMenuItems"
      draggable
      :class="{ incompatible: !pack.compatible, 'border-yellow-300': pack.enabled }"
      class="draggable-card invisible-scroll cursor-pointer border border-dashed border-transparent transition-all duration-150"
      @dragstart="onDragStart"
      @dragenter="onDragEnter"
      @dragleave="onDragLeave"
      @dragend.prevent="onDragEnd"
      @mouseenter="hovered = true"
      @mouseleave="hovered = false"
      @drop="emit('drop', $event); onDragLeave()"
    >
      <div
        v-shared-tooltip="tooltip"
        class="flex max-h-[80px] max-w-full overflow-x-auto"
      >
        <img
          ref="iconImage"
          v-fallback-img="unknownPack"
          style="image-rendering: pixelated"
          class="h-[80px] select-none"
          :src="pack.resourcePack.icon"
          contain
        >
        <div class="flex flex-col gap-1 overflow-x-auto px-3">
          <text-component
            v-once
            v-shared-tooltip="name"
            class="mt-2 w-full overflow-x-auto whitespace-nowrap text-lg font-semibold"
            :source="name"
            editable
            @edit="onEditPackName(pack, $event)"
          />
          <text-component
            class="whitespace-normal break-words text-sm"
            :source="description"
          />
        </div>
      </div>
      <v-divider
        v-show="pack.tags.length > 0"
      />
      <v-card-actions v-show="pack.tags.length > 0">
        <div class="flex flex-wrap gap-2">
          <v-chip
            v-for="(tag, index) in pack.tags"
            :key="`${tag}-${index}`"
            :outlined="darkTheme"
            :color="getColor(tag)"
            label
            close
            @click:close="onDeleteTag(tag)"
          >
            <span
              contenteditable
              class="max-w-90 sm:max-w-40 overflow-scroll"
              :class="{ 'text-white': hovered }"
              @input.stop="onEditTag($event, index)"
              @blur="notifyTagChange(pack)"
            >{{ tag }}</span>
          </v-chip>
        </div>
      </v-card-actions>
    </v-card>
  </div>
</template>

<script lang=ts setup>
import unknownPack from '@/assets/unknown_pack.png'
import { useDragTransferItem, useService, useTags, useTheme } from '@/composables'
import { ResourcePackItem } from '@/composables/instanceResourcePackItem'
import { vSharedTooltip } from '@/directives/sharedTooltip'
import { getColor } from '@/util/color'
import { injection } from '@/util/inject'
import { BaseServiceKey } from '@xmcl/runtime-api'
import { Ref } from 'vue'
import { ContextMenuItem } from '../composables/contextMenu'
import { kMarketRoute } from '../composables/useMarketRoute'
import { vContextMenu } from '../directives/contextMenu'
import { vDraggableCard } from '../directives/draggableCard'
import { vFallbackImg } from '../directives/fallbackImage'

const props = defineProps<{
  pack: ResourcePackItem
  isSelected: boolean
  minecraft: string
}>()

const emit = defineEmits(['tags', 'dragstart', 'dragend', 'delete', 'drop'])
const { darkTheme } = useTheme()

const { t } = useI18n()
const name = computed(() => props.pack.resourcePack.id === 'vanilla' ? t('resourcepack.defaultName') : props.pack.name)
const description = computed(() => props.pack.resourcePack.id === 'vanilla' ? t('resourcepack.defaultName') : props.pack.resourcePack.description)

const iconImage: Ref<any> = ref(null)

const { searchInCurseforge, goCurseforgeProject, searchInModrinth, goModrinthProject } = injection(kMarketRoute)
const { showItemInDirectory } = useService(BaseServiceKey)
const card: Ref<any> = ref(null)

const hovered = ref(false)
const { editTag, createTag, removeTag } = useTags(computed({
  get: () => props.pack.tags,
  set: (v) => { emit('tags', v) },
}))
const onDeleteTag = removeTag

useDragTransferItem(computed(() => card.value?.$el as HTMLElement), props.pack.resourcePack.id, props.isSelected ? 'right' : 'left')

const dragover = ref(0)
const onDragEnter = (e: DragEvent) => {
  dragover.value += 1
}
const onDragLeave = () => {
  dragover.value += -1
}

const tooltip = computed(() => props.pack.compatible
  ? t('resourcepack.compatible', {
    format: props.pack.resourcePack.pack_format,
    version: props.minecraft,
  })
  : t('resourcepack.incompatible', {
    accept: props.pack.resourcePack.acceptingRange,
    actual: props.minecraft,
    format: props.pack.resourcePack.pack_format,
  }))

const contextMenuItems = computed(() => {
  if (props.pack.resourcePack.id === 'vanilla') {
    return []
  }
  const menuItems: ContextMenuItem[] = [{
    text: t('resourcepack.showFile', { file: props.pack.resourcePack.path }),
    onClick: () => {
      showItemInDirectory(props.pack.resourcePack.path)
    },
    icon: 'folder',
  }, {
    text: t('tag.create'),
    onClick() {
      createTag()
    },
    icon: 'add',
  }]
  if (!props.isSelected) {
    menuItems.push({
      text: t('delete.name', { name: props.pack.name }),
      onClick() {
        emit('delete')
      },
      icon: 'delete',
      color: 'error',
    })
  }
  if (props.pack.resourcePack.resource && props.pack.resourcePack.resource.metadata.curseforge) {
    menuItems.push({
      text: t('resourcepack.showInCurseforge', { name: props.pack.name }),
      onClick: () => {
        goCurseforgeProject(props.pack.resourcePack.resource!.metadata.curseforge!.projectId, 'texture-packs')
      },
      icon: '$vuetify.icons.curseforge',
    })
  } else {
    menuItems.push({
      text: t('resourcepack.searchOnCurseforge', { name: props.pack.name }),
      onClick: () => {
        searchInCurseforge(props.pack.name, 'texture-packs')
      },
      icon: 'search',
    })
  }

  if (props.pack.resourcePack.resource && props.pack.resourcePack.resource.metadata.modrinth) {
    menuItems.push({
      text: t('resourcepack.showInModrinth', { name: props.pack.name }),
      onClick: () => {
        goModrinthProject(props.pack.resourcePack.resource!.metadata.modrinth!.projectId)
      },
      icon: '$vuetify.icons.modrinth',
    })
  } else {
    menuItems.push({
      text: t('resourcepack.searchOnModrinth', { name: props.pack.name }),
      onClick: () => {
        searchInModrinth(props.pack.name)
      },
      icon: 'search',
    })
  }

  return menuItems
})

function onDragStart(e: DragEvent) {
  e.dataTransfer!.effectAllowed = 'move'
  if (props.pack.resourcePack.id !== 'vanilla') {
    emit('dragstart', e)
  }
  e.dataTransfer!.setDragImage(iconImage.value, 0, 0)
}
function onDragEnd(e: DragEvent) {
  if (props.pack.resourcePack.id !== 'vanilla') {
    emit('dragend', e)
  }
}
function onEditTag(event: Event, index: number) {
  if (event.target && event.target instanceof HTMLElement) {
    editTag(event.target.innerText, index)
  }
}
function notifyTagChange(item: ResourcePackItem) {
  item.tags = [...item.tags]
}
function onEditPackName(item: ResourcePackItem, name: string) {
  item.name = name
}
</script>

<style scoped=true>
.incompatible.draggable-card:hover {
  background-color: var(--warning-color-decent);
}
.draggable-card:hover {
  background-color: var(--primary);
}
.title {
  max-width: 100%;
  white-space: nowrap;
  line-height: 10px;
}
</style>
