<template>
  <v-card
    ref="card"
    v-draggable-card
    v-context-menu="contextMenuItems"
    outlined
    draggable
    :class="{ incompatible: !compatible }"
    class="draggable-card cursor-pointer transition-all duration-150"
    style="margin-top: 10px"
    @dragstart="onDragStart"
    @dragend.prevent="onDragEnd"
    @mouseenter="hovered = true"
    @mouseleave="hovered = false"
  >
    <v-tooltip top>
      <template #activator="{ on }">
        <div class="pr-2">
          <v-layout
            justify-center
            align-center
            fill-height
            v-on="on"
          >
            <v-flex class="p-0">
              <img
                ref="iconImage"
                v-fallback-img="unknownPack"
                class="select-none h-[125px]"
                :src="pack.icon"
                contain
              >
            </v-flex>
            <v-flex
              xs7
              md8
              lg9
              class="flex-col"
            >
              <div class="py-2 flex flex-col gap-2">
                <text-component
                  v-once
                  style="white-space: normal; word-break: break-word"
                  :source="pack.name"
                  editable
                  class="title"
                  @edit="onEditPackName(pack, $event)"
                />
                <text-component
                  style="white-space: normal; word-break: break-word"
                  :source="pack.description"
                />
              </div>
            </v-flex>
          </v-layout>
          <v-divider
            v-show="pack.tags.length > 0"
            class="mt-1"
          />
          <v-card-actions v-show="pack.tags.length > 0">
            <div class="flex gap-2 flex-wrap">
              <v-chip
                v-for="(tag, index) in pack.tags"
                :key="`${tag}-${index}`"
                :color="getColor(tag)"
                label
                outlined
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
        </div>
      </template>
      <span>
        {{
          compatible
            ? $t("resourcepack.compatible", {
              format: pack.pack_format,
              version: runtime.minecraft,
            })
            : $t("resourcepack.incompatible", {
              accept: pack.acceptingRange,
              actual: runtime.minecraft,
              format: pack.pack_format,
            })
        }}
      </span>
    </v-tooltip>
  </v-card>
</template>

<script lang=ts setup>
import { Ref } from '@vue/composition-api'
import { BaseServiceKey, InstanceServiceKey } from '@xmcl/runtime-api'
import { useRangeCompatible } from '../composables/compatible'
import { ContextMenuItem } from '../composables/contextMenu'
import { useCurseforgeRoute } from '../composables/curseforgeRoute'
import { ResourcePackItem } from '../composables/resourcePack'
import { vContextMenu } from '../directives/contextMenu'
import unknownPack from '/@/assets/unknown_pack.png'
import { useDragTransferItem, useI18n, useService, useTags } from '/@/composables'
import { getColor } from '/@/util/color'

const props = defineProps<{
  pack: ResourcePackItem
  isSelected: boolean
}>()

const emit = defineEmits(['tags', 'dragstart', 'dragend'])

const iconImage: Ref<any> = ref(null)
const { state } = useService(InstanceServiceKey)
const runtime = computed(() => state.instance.runtime)
const { compatible } = useRangeCompatible(computed(() => props.pack.acceptingRange ?? ''), computed(() => runtime.value.minecraft))
const { t } = useI18n()
const { searchProjectAndRoute, goProjectAndRoute } = useCurseforgeRoute()
const { showItemInDirectory } = useService(BaseServiceKey)
const card: Ref<any> = ref(null)

const hovered = ref(false)
const { editTag, createTag, removeTag } = useTags(computed({
  get: () => props.pack.tags,
  set: (v) => { emit('tags', v) },
}))
const onDeleteTag = removeTag

useDragTransferItem(computed(() => card.value?.$el as HTMLElement), props.pack.id, props.isSelected ? 'right' : 'left')
const tags = ref([...props.pack.tags])

const contextMenuItems = computed(() => {
  if (props.pack.id === 'vanilla') {
    return []
  }
  const menuItems: ContextMenuItem[] = [{
    text: t('resourcepack.showFile', { file: props.pack.path }),
    children: [],
    onClick: () => {
      showItemInDirectory(props.pack.path)
    },
    icon: 'folder',
  }, {
    text: t('tag.create'),
    children: [],
    onClick() {
      createTag()
    },
    icon: 'add',
  }]
  if (props.pack.resource && props.pack.resource.curseforge) {
    menuItems.push({
      text: t('resourcepack.showInCurseforge', { name: props.pack.name }),
      children: [],
      onClick: () => {
        goProjectAndRoute(props.pack.resource!.curseforge!.projectId, 'texture-packs')
      },
      icon: '$vuetify.icons.curseforge',
    })
  } else {
    menuItems.push({
      text: t('resourcepack.searchOnCurseforge', { name: props.pack.name }),
      children: [],
      onClick: () => {
        searchProjectAndRoute(props.pack.name, 'texture-packs')
      },
      icon: 'search',
    })
  }
  return menuItems
})

function onDragStart(e: DragEvent) {
  e.dataTransfer!.effectAllowed = 'move'
  if (props.pack.id !== 'vanilla') {
    emit('dragstart', e)
  }
  e.dataTransfer!.setDragImage(iconImage.value, 0, 0)
}
function onDragEnd(e: DragEvent) {
  if (props.pack.id !== 'vanilla') {
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
  background-color: var(--primary-color);
}
.title {
  max-width: 100%;
  white-space: nowrap;
}
</style>
