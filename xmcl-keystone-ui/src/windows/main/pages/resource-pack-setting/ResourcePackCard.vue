<template>
  <v-card
    ref="card"
    v-draggable-card
    color="darken-1"
    hover
    draggable
    :class="{ incompatible: !compatible }"
    class="draggable-card white--text elevation-4"
    style="margin-top: 10px"
    @dragstart="onDragStart"
    @dragend.prevent="onDragEnd"
    @contextmenu="openContextMenu"
    @mouseenter="hovered = true"
    @mouseleave="hovered = false"
  >
    <v-tooltip top>
      <template #activator="{ on }">
        <v-layout justify-center align-center fill-height v-on="on">
          <v-flex class="p-0">
            <img
              ref="iconImage"
              v-fallback-img="unknownPack"
              class="select-none h-[125px]"
              :src="pack.icon"
              contain
            />
          </v-flex>
          <v-flex xs7 md8 lg9 class="flex-col">
            <div class="py-2 flex flex-col gap-2">
              <text-component
                v-once
                style="white-space: normal; word-break: break-word"
                :source="pack.name"
                editable
                @edit="onEditPackName(pack, $event)"
                class="title"
              />
              <text-component
                style="white-space: normal; word-break: break-word"
                :source="pack.description"
              />
            </div>
          </v-flex>
        </v-layout>
        <v-divider v-show="pack.tags.length > 0" class="mt-1"></v-divider>
        <v-card-actions v-show="pack.tags.length > 0">
          <div>
            <v-chip
              v-for="(tag, index) in pack.tags"
              :color="getColor(tag)"
              label
              outline
              :key="`${tag}-${index}`"
              close
              @input="onDeleteTag(tag)"
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
      </template>
      <span>
        {{
          compatible
            ? $t("resourcepack.compatible", {
              format: pack.pack_format,
              version: mcversion,
            })
            : $t("resourcepack.incompatible", {
              accept: pack.acceptingRange,
              actual: mcversion,
              format: pack.pack_format,
            })
        }}
      </span>
    </v-tooltip>
  </v-card>
</template>

<script lang=ts>
import { defineComponent, ref, Ref, computed, set } from '@vue/composition-api'
import { useInstanceVersionBase, useCompatible, useDragTransferItem, ResourcePackItem, useI18n, useService, useTagColors, useTagCreation, useTags } from '/@/hooks'
import { required } from '/@/util/props'
import { useContextMenu, ContextMenuItem, useCurseforgeRoute } from '/@/windows/main/composables'
import { BaseServiceKey } from '@xmcl/runtime-api'
import unknownPack from '/@/assets/unknown_pack.png'
import { getColor } from '/@/util/color'

export default defineComponent({
  props: {
    pack: required<ResourcePackItem>(Object),
    isSelected: required<boolean>(Boolean),
  },
  setup(props, context) {
    const iconImage: Ref<any> = ref(null)
    const { minecraft } = useInstanceVersionBase()
    const { compatible } = useCompatible(computed(() => props.pack.acceptingRange ?? ''), minecraft)
    const { open } = useContextMenu()
    const { $t } = useI18n()
    const { searchProjectAndRoute, goProjectAndRoute } = useCurseforgeRoute()
    const { showItemInDirectory } = useService(BaseServiceKey)
    const card: Ref<any> = ref(null)

    const hovered = ref(false)
    const { colors } = useTagColors()
    const { editTag, createTag, removeTag } = useTags(computed({
      get: () => props.pack.tags,
      set: (v) => { props.pack.tags = v }
    }))

    useDragTransferItem(computed(() => card.value?.$el as HTMLElement), props.pack.id, props.isSelected ? 'right' : 'left')
    const tags = ref([...props.pack.tags])

    function onDragStart(e: DragEvent) {
      e.dataTransfer!.effectAllowed = 'move'
      if (props.pack.id !== 'vanilla') {
        context.emit('dragstart', e)
      }
      e.dataTransfer!.setDragImage(iconImage.value, 0, 0)
    }
    function onDragEnd(e: DragEvent) {
      if (props.pack.id !== 'vanilla') {
        context.emit('dragend', e)
      }
    }
    function onEditTag(event: InputEvent, index: number) {
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
    function openContextMenu(e: MouseEvent) {
      if (props.pack.id === 'vanilla') {
        return
      }
      const menuItems: ContextMenuItem[] = [{
        text: $t('resourcepack.showFile', { file: props.pack.path }),
        children: [],
        onClick: () => {
          showItemInDirectory(props.pack.path)
        },
        icon: 'folder',
      }, {
        text: $t('tag.create'),
        children: [],
        onClick() {
          createTag()
        },
        icon: 'add'
      }]
      if (props.pack.resource && props.pack.resource.curseforge) {
        menuItems.push({
          text: $t('resourcepack.showInCurseforge', { name: props.pack.name }),
          children: [],
          onClick: () => {
            goProjectAndRoute(props.pack.resource!.curseforge!.projectId, 'texture-packs')
          },
          icon: '$vuetify.icons.curseforge',
        })
      } else {
        menuItems.push({
          text: $t('resourcepack.searchOnCurseforge', { name: props.pack.name }),
          children: [],
          onClick: () => {
            searchProjectAndRoute(props.pack.name, 'texture-packs')
          },
          icon: 'search',
        })
      }
      open(e.clientX, e.clientY, menuItems)
    }
    return {
      onEditPackName,
      compatible,
      iconImage,
      onDragStart,
      onDragEnd,
      mcversion: minecraft,
      card,
      onEditTag,
      openContextMenu,
      getColor,
      unknownPack,
      tags,
      colors,
      onDeleteTag: removeTag,
      notifyTagChange,
      hovered,
    }
  },
})
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
