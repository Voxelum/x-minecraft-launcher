<template>
  <v-card
    v-selectable-card
    v-long-press="onSelect"
    v-context-menu="contextMenuItems"
    outlined
    :draggable="!item.enabled"
    :class="{
      incompatible: isCompatible === false,
      maybe: isCompatible === 'maybe',
      subsequence: item.subsequence === true,
      dragged: item.dragged,
    }"
    class="draggable-card mod-card rounded-lg transition-all duration-200 shadow"
    style="margin-top: 10px; padding: 0 10px;"
    @dragstart="onDragStart"
    @click="onClick($event, index)"
  >
    <v-progress-linear
      v-if="enabled !== item.enabledState"
      buffer-value="0"
      color="orange"
      class="absolute bottom-0 left-0"
      stream
    />
    <v-progress-linear
      v-if="enabled !== item.enabledState"
      buffer-value="0"
      color="orange"
      class="absolute top-0 left-0"
      stream
    />
    <TransitionGroup
      class="layout justify-center align-center fill-height select-none"
      name="transition-list"
      tag="div"
    >
      <v-flex
        :key="0"
        class="flex-grow-0 "
        :style="{ display: selection ? 'flex' : 'none !important' }"
      >
        <v-checkbox
          v-model="item.selected"
          @input="onSelect()"
        />
      </v-flex>
      <v-flex
        v-if="!item.subsequence"
        :key="1"
        class="avatar"
      >
        <v-img
          ref="iconImage"
          :lazy-src="unknownPack"
          class="rounded object-contain image-render-pixel"
          :src="item.icon"
        />
      </v-flex>
      <div
        :key="2"
        class="flex-grow py-2 flex flex-col flex-1 overflow-x-auto"
      >
        <h3
          class="px-1"
        >
          <text-component
            :source="item.name"
          />
          <span class="text-gray-400 text-sm">
            {{ item.version }}
          </span>
        </h3>
        <v-card-text
          class="px-1 py-0 min-h-[22px] overflow-hidden overflow-ellipsis whitespace-nowrap"
        >
          <text-component
            :source="item.description"
          />
        </v-card-text>
        <ModCardLabels
          :source="item"
          :compatibility="compatibility"
          :on-edit-tag="onEditTag"
          :on-delete-tag="onDeleteTag"
        />
      </div>
      <v-flex
        :key="3"
        style="flex-grow: 0"
        @click.stop
        @mousedown.stop
      >
        <v-switch
          v-model="enabled"
        />
      </v-flex>
    </TransitionGroup>
  </v-card>
</template>

<script lang=ts setup>
import unknownPack from '@/assets/unknown_pack.png'
import { useTags } from '@/composables'
import { useModCompatibility } from '@/composables/modCompatibility'
import { useModItemContextMenuItems } from '@/composables/modContextMenu'
import type Vue from 'vue'
import { Ref } from 'vue'
import { ModItem } from '../composables/mod'
import { vContextMenu } from '../directives/contextMenu'
import { vSelectableCard } from '../directives/draggableCard'
import { vLongPress } from '../directives/longPress'
import ModCardLabels from './ModCardLabels.vue'

const props = defineProps<{
  item: ModItem
  index: number
  selection: boolean
  onItemDragstart(mod: ModItem): void
  onTags(item: ModItem, tags: string[]): void
  onSelect(): void
  onDelete(item: ModItem): void
  onClick(event: MouseEvent, index: number): void
  onEnable(event: { item: ModItem; enabled: boolean }): void
}>()

const modItem = computed(() => props.item)
const { createTag, editTag, removeTag } = useTags(computed({ get: () => props.item.tags, set(v) { props.onTags(props.item, v) } }), computed(() => props.item.selected))
const { isCompatible, compatibility } = useModCompatibility(modItem)

const onDeleteTag = removeTag
const iconImage: Ref<Vue | null> = ref(null)
const enabled = computed({
  get() { return props.item.enabled },
  set(v: boolean) { props.onEnable({ item: props.item, enabled: v }) },
})

function onDragStart(e: DragEvent) {
  if (props.item.enabled) {
    return
  }
  if (iconImage.value) {
    e.dataTransfer!.setDragImage(iconImage.value.$el!, 0, 0)
  } else {
    const img = document.createElement('img')
    img.src = props.item.icon
    img.style.maxHeight = '126px'
    img.style.maxWidth = '126px'
    img.style.objectFit = 'contain'

    e.dataTransfer!.setDragImage(img, 0, 0)
  }
  e.dataTransfer!.effectAllowed = 'move'
  e.dataTransfer!.setData('id', props.item.url)
  props.onItemDragstart(props.item)
}
function onEditTag(event: Event, index: number) {
  if (event instanceof FocusEvent) {
    if (event.type === 'blur') {
      props.onTags(props.item, [...props.item.tags])
    }
  } else if (event.target instanceof HTMLDivElement) {
    if ((event as any).inputType === 'insertParagraph' || ((event as any).inputType === 'insertText' && (event as any).data === null)) {
      props.onTags(props.item, [...props.item.tags])
    } else {
      editTag(event.target.innerText, index)
    }
  }
}

const contextMenuItems = useModItemContextMenuItems(modItem, () => props.onDelete(props.item), createTag)
</script>

<style scoped>

.draggable-card:hover {
  color: rgba(255,255,255, 0.9) !important;
}
.draggable-card:hover {
  background-color: #388e3c;
}

.unknown:hover {
  background-color: #bb724b;
}
.maybe:hover {
  background-color: #679793 !important;
}
.title {
  max-width: 100%;
  white-space: nowrap;
}
.subsequence {
  margin-left: 60px;
}
.incompatible.draggable-card:hover {
  background-color: #e65100;
}

.dark .subsequence.draggable-card {
  /* background-color: rgba(255, 255, 255, 0.15); */
  border-color: rgba(255, 255, 255, 0.15);
  background-color: rgba(52, 52, 52, 0.15);
  /* border-color: #343434; */
}
.subsequence.draggable-card {
  background-color: rgba(0, 0, 0, 0.1);
  border-color: rgba(0, 0, 0, 0.1);
}

.subsequence.draggable-card:hover {
  background-color: #388e3c;
}
.subsequence.incompatible.draggable-card:hover {
  background-color: #e65100 !important;
}
.mod-card .avatar {
  min-height: 50px;
  max-height: 50px;
  max-width:  50px;
  min-width:  50px;
  margin: 0 10px 0 0;
}
</style>
