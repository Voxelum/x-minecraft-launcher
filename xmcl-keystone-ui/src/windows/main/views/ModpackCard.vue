<template>
  <v-card
    v-draggable-card
    v-context-menu="contextMenuItems"
    outlined
    draggable
    class="draggable-card rounded-lg transition-all duration-200  cursor-pointer max-w-[30%]"
    @dragstart="$emit('dragstart')"
    @dragend="$emit('dragend')"
  >
    <v-img
      v-if="item.icon"
      height="250"
      :src="item.icon"
    >
      <template #placeholder>
        <v-skeleton-loader type="image" />
      </template>
    </v-img>
    <v-card-title>
      {{ item.name }}
      <span
        v-if="item.author"
        class="pl-2 text-sm text-gray-400"
      >
        by
        {{ item.author }}
      </span>
    </v-card-title>
    <v-card-subtitle class="flex flex-col">
      <div class="">
        {{ item.version }}
      </div>
      <div>
        <v-icon small>
          sd_card
        </v-icon>
        {{ (item.size / 1024 / 1024).toFixed(2) }} MB
      </div>
      <div>
        <v-icon small>
          event
        </v-icon>
        {{ new Date(item.resource.date).toLocaleTimeString() }}
      </div>
    </v-card-subtitle>
    <v-divider class="mx-4" />
    <div class="p-2 flex gap-2 flex-wrap">
      <v-chip
        v-for="(tag, index) in item.tags"
        :key="tag"
        label
        outlined
        close
        @click:close="onDeleteTag(tag)"
      >
        <div
          contenteditable
          class="max-w-50 overflow-auto"
          @input.stop="onEditTag($event, index)"
          @blur="$emit('tags', [...item.tags])"
        >
          {{ tag }}
        </div>
      </v-chip>
    </div>
    <v-card-actions>
      <v-btn
        block
        text
        @click="$emit('create')"
      >
        <v-icon>
          add
        </v-icon>
      </v-btn>
    </v-card-actions>
  </v-card>
</template>
<script lang="ts">
import { computed, defineComponent, Ref } from '@vue/composition-api'
import { BaseServiceKey } from '@xmcl/runtime-api'
import { useI18n, useService, useTags } from '/@/composables'
import { required } from '/@/util/props'
import { ContextMenuItem } from '../composables/contextMenu'
import { useCurseforgeRoute } from '../composables/curseforgeRoute'
import { ModpackItem } from './Modpack.vue'

export default defineComponent({
  props: { item: required<ModpackItem>(Object) },
  setup(props, context) {
    const { $t } = useI18n()
    const { showItemInDirectory } = useService(BaseServiceKey)
    const { goProjectAndRoute } = useCurseforgeRoute()
    const { createTag, editTag, removeTag } = useTags(computed({ get: () => props.item.tags, set(v) { context.emit('tags', v) } }))
    const contextMenuItems: Ref<ContextMenuItem[]> = computed(() => {
      const items: ContextMenuItem[] = [{
        text: $t('modpack.showFile', { file: props.item.resource.path }),
        children: [],
        onClick: () => {
          showItemInDirectory(props.item.resource.path)
        },
        icon: 'folder',
      }, {
        text: $t('tag.create'),
        children: [],
        onClick: () => {
          createTag()
        },
        icon: 'add',
      }]
      if (props.item.resource.curseforge) {
        items.push({
          text: $t('modpack.showInCurseforge', { name: props.item.name }),
          children: [],
          onClick: () => {
            goProjectAndRoute(props.item.resource.curseforge!.projectId, 'modpacks')
          },
          icon: '$vuetify.icons.curseforge',
        })
      }
      return items
    })
    function onEditTag(event: Event, index: number) {
      if (event.target instanceof HTMLDivElement) {
        editTag(event.target.innerText, index)
      }
    }
    return {
      contextMenuItems,
      onDeleteTag: removeTag,
      onEditTag,
    }
  },
})
</script>
