<template>
  <v-card
    v-draggable-card
    v-selectable-card
    hover
    dark
    :draggable="!pack.enabled && pack.path"
    class="white--text draggable-card flex duration-200 mt-2 flex-row flex-nowrap select-none"
    :class="{ enabled: pack.enabled }"
    @contextmenu="onContextMenu"
    @click="onSelect"
    @dragstart="$emit('dragstart', pack)"
    @dragend="$emit('dragend')"
  >
    <div class="self-center px-2">
      <img
        v-fallback-img="unknownPack"
        :src="unknownPack"
        contain
        width="60"
        height="60"
      >
    </div>
    <div class="flex-grow">
      <v-card-title class="flex flex-col items-start gap-2">
        <div
          v-once
          class="text-lg font-bold text"
          :contenteditable="!builtin"
          @input="updateName"
        >
          {{ pack.name }}
        </div>
        <div v-if="pack.tags.length > 0">
          <v-chip
            v-for="(tag, index) in pack.tags"
            :key="`${tag}${index}`"
            :color="getColor(tag)"
            label
            small
            close
            outline
            @input="onRemoveTag(tag)"
          >
            <div
              contenteditable
              @input.stop="onEditTag($event, index)"
              @blur="onEditTagEnd(pack)"
            >
              {{ tag }}
            </div>
          </v-chip>
        </div>
        <div style="color: #bdbdbd; ">
          {{ pack.description }}
        </div>
      </v-card-title>
    </div>
    <div class="self-center flex-shrink pr-2">
      <v-switch
        readonly
        :value="pack.enabled"
        @input="$emit('enable', $event)"
      />
    </div>
  </v-card>
</template>
<script lang="ts">
import { computed, defineComponent } from '@vue/composition-api'
import { useContextMenu } from '/@/windows/main/composables'
import unknownPack from '/@/assets/unknown_pack.png'
import { useI18n, useService, useTags } from '/@/hooks'
import { ShaderPackItem } from '/@/hooks/useShaderpacks'
import { getColor } from '/@/util/color'
import { required } from '/@/util/props'
import { BaseServiceKey } from '@xmcl/runtime-api'

export default defineComponent({
  props: {
    pack: required<ShaderPackItem>(Object),
  },
  emits: ['update:name', 'enable', 'tags'],
  setup(props, context) {
    const { open } = useContextMenu()
    const { $t } = useI18n()
    const { showItemInDirectory } = useService(BaseServiceKey)

    const builtin = computed(() => props.pack.value === 'OFF' || props.pack.value === '(internal)')
    const { createTag, editTag, removeTag } = useTags(computed({ get() { return props.pack.tags }, set(v) { context.emit('tags', v) } }))
    function onEditTag(event: Event, index: number) {
      if (event.target instanceof HTMLDivElement) {
        editTag(event.target.innerText, index)
      }
    }
    function onEditTagEnd(item: ShaderPackItem) {
      item.tags = [...item.tags]
    }
    function updateName(event: Event) {
      if (event.target instanceof HTMLDivElement) {
        context.emit('update:name', event.target.innerText)
      }
    }
    function onContextMenu(e: MouseEvent) {
      if (builtin.value) {
        return
      }
      open(e.clientX, e.clientY, [
        {
          text: $t('shaderpack.showFile', { file: props.pack.path }),
          children: [],
          onClick: () => {
            showItemInDirectory(props.pack.path)
          },
          icon: 'folder',
        },
        {
          text: $t('tag.create'),
          children: [],
          onClick() {
            createTag()
          },
          icon: 'add',
        },
      ])
    }
    function onSelect() {
      context.emit('select', props.pack)
    }
    return { getColor, onSelect, onContextMenu, onEditTag, onRemoveTag: removeTag, updateName, builtin, unknownPack, onEditTagEnd }
  },
})
</script>

<style scoped>
.enabled {
  background-color: #388e3c;
}
</style>
