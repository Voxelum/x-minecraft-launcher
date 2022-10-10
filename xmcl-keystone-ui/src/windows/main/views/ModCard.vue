<template>
  <v-card
    v-selectable-card
    v-long-press="emitSelect"
    v-context-menu="contextMenuItems"
    outlined
    :draggable="!source.enabled"
    :class="{
      incompatible: props.source.compatible === false,
      maybe: props.source.compatible === 'maybe',
      subsequence: source.subsequence === true,
      dragged: source.dragged,
    }"
    class="draggable-card mod-card rounded-lg transition-all duration-200 shadow min-w-200"
    style="margin-top: 10px; padding: 0 10px; content-visibility: auto;"
    @dragstart="onDragStart"
    @dragend="emit('dragend', $event)"
    @mouseenter="emit('mouseenter', $event)"
    @click="emit('click', $event)"
  >
    <v-progress-linear
      v-if="enabled !== source.enabledState"
      buffer-value="0"
      color="orange"
      class="absolute bottom-0 left-0"
      stream
    />
    <v-progress-linear
      v-if="enabled !== source.enabledState"
      buffer-value="0"
      color="orange"
      class="absolute top-0 left-0"
      stream
    />
    <transition-group
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
          v-model="source.selected"
          @input="emit('select')"
        />
      </v-flex>
      <v-flex
        v-if="!source.subsequence"
        :key="1"
        class="avatar"
      >
        <v-img
          ref="iconImage"
          :lazy-src="unknownPack"
          class="rounded object-contain image-render-pixel"
          :src="source.icon"
        />
      </v-flex>
      <div
        :key="2"
        class="flex-grow py-2"
      >
        <h3
          class="px-1"
        >
          <text-component
            v-if="!source.subsequence"
            :source="source.name"
          />
          <span class="text-gray-400 text-sm">
            {{ source.version }}
          </span>
        </h3>
        <v-card-text
          v-if="!source.subsequence"
          class="px-1 py-0"
        >
          <text-component :source="source.description" />
        </v-card-text>
        <mod-card-labels
          :source="source"
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
    </transition-group>
  </v-card>
</template>

<script lang=ts setup>
import { Ref } from '@vue/composition-api'
import { BaseServiceKey } from '@xmcl/runtime-api'
import type Vue from 'vue'
import { ContextMenuItem } from '../composables/contextMenu'
import { useCurseforgeRoute, useMcWikiRoute } from '../composables/curseforgeRoute'
import { ModItem } from '../composables/mod'
import { vContextMenu } from '../directives/contextMenu'
import { vSelectableCard } from '../directives/draggableCard'
import { vLongPress } from '../directives/longPress'
import ModCardLabels from './ModCardLabels.vue'
import unknownPack from '/@/assets/unknown_pack.png'
import { useI18n, useRouter, useService, useTags } from '/@/composables'

const props = defineProps<{ source: ModItem; selection: boolean }>()
const emit = defineEmits(['tags', 'enable', 'dragstart', 'select', 'delete', 'editTags', 'mouseenter', 'dragend', 'click'])

const { openInBrowser, showItemInDirectory } = useService(BaseServiceKey)
const { push } = useRouter()
const { searchProjectAndRoute, goProjectAndRoute } = useCurseforgeRoute()
const { searchProjectAndRoute: searchMcWiki } = useMcWikiRoute()
const { t } = useI18n()
const { createTag, editTag, removeTag } = useTags(computed({ get: () => props.source.tags, set(v) { emit('tags', v) } }), computed(() => props.source.selected))

const onDeleteTag = removeTag
const iconImage: Ref<Vue | null> = ref(null)
const enabled = computed({
  get() { return props.source.enabled },
  set(v: boolean) { emit('enable', { item: props.source, enabled: v }) },
})

function onDragStart(e: DragEvent) {
  if (props.source.enabled) {
    return
  }
  if (iconImage.value) {
    e.dataTransfer!.setDragImage(iconImage.value.$el!, 0, 0)
  } else {
    const img = document.createElement('img')
    img.src = props.source.icon
    img.style.maxHeight = '126px'
    img.style.maxWidth = '126px'
    img.style.objectFit = 'contain'

    e.dataTransfer!.setDragImage(img, 0, 0)
  }
  e.dataTransfer!.effectAllowed = 'move'
  e.dataTransfer!.setData('id', props.source.url)
  emit('dragstart', e)
}
function onEditTag(event: Event, index: number) {
  if (event.target instanceof HTMLDivElement) {
    if ((event as any).inputType === 'insertParagraph' || ((event as any).inputType === 'insertText' && (event as any).data === null)) {
      emit('tags', [...props.source.tags])
    } else {
      editTag(event.target.innerText, index)
    }
  }
}
function emitSelect() {
  emit('select')
}

const contextMenuItems = computed(() => {
  const items: ContextMenuItem[] = [{
    text: t('mod.showFile', { file: props.source.path }),
    children: [],
    onClick: () => {
      showItemInDirectory(props.source.path)
    },
    icon: 'folder',
  }, {
    text: t('tag.create'),
    children: [],
    onClick: () => {
      createTag()
    },
    icon: 'add',
  }]
  if (props.source.selected) {
    items.push({
      text: t('tag.createSelected'),
      children: [],
      onClick: () => {
        createTag(true)
      },
      icon: 'add',
    })
  }
  if (!props.source.enabledState || !props.source.enabled) {
    items.push({
      text: t('delete.name', { name: props.source.name }),
      children: [],
      onClick() {
        emit('delete')
      },
      icon: 'delete',
      color: 'error',
    })
  }
  if (props.source.url) {
    const url = props.source.url
    items.push({
      text: t('mod.openLink', { url }),
      children: [],
      onClick: () => {
        openInBrowser(url)
      },
      icon: 'link',
    })
  }
  if (props.source.curseforge) {
    const curseforge = props.source.curseforge
    items.push({
      text: t('mod.showInCurseforge', { name: props.source.name }),
      children: [],
      onClick: () => {
        goProjectAndRoute(curseforge.projectId, 'mc-mods')
      },
      icon: '$vuetify.icons.curseforge',
    })
  } else {
    items.push({
      text: t('mod.searchOnCurseforge', { name: props.source.name }),
      children: [],
      onClick: () => {
        searchProjectAndRoute(props.source.name, 'mc-mods')
      },
      icon: 'search',
    })
  }
  if (props.source.modrinth) {
    const modrinth = props.source.modrinth
    items.push({
      text: t('mod.showInModrinth', { name: props.source.name }),
      children: [],
      onClick: () => {
        push(`/modrinth/${modrinth.projectId}`)
      },
      icon: '$vuetify.icons.modrinth',
    })
  } else {
    items.push({
      text: t('mod.searchOnModrinth', { name: props.source.name }),
      children: [],
      onClick: () => {
        push(`/modrinth?query=${props.source.name}`)
      },
      icon: 'search',
    })
  }
  items.push({
    text: t('mod.searchOnMcWiki', { name: props.source.name }),
    children: [],
    onClick: () => {
      searchMcWiki(props.source.name)
    },
    icon: 'search',
  })
  return items
})
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
  margin-left: 45px;
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
