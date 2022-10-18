<template>
  <v-card
    v-draggable-card
    v-context-menu="contextMenuItems"
    outlined
    draggable
    hover
    class="draggable-card rounded-lg transition-all duration-200 cursor-pointer max-w-[30%]"
    style="transition: all; transition-duration: 200ms;"
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
    </v-card-title>
    <v-card-subtitle class="flex flex-col">
      <span
        v-if="item.author"
      >
        <v-icon small>
          person
        </v-icon>
        {{ item.author }}
      </span>
      <div class="">
        <v-icon small>
          history
        </v-icon>
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
        {{ time }}
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
<script lang="ts" setup>
import { Ref } from 'vue'
import { BaseServiceKey } from '@xmcl/runtime-api'
import { useService, useTags } from '@/composables'
import { ContextMenuItem } from '../composables/contextMenu'
import { useCurseforgeRoute } from '../composables/curseforgeRoute'
import { vContextMenu } from '../directives/contextMenu'
import { ModpackItem } from '../composables/modpack'
import { getLocalDateString } from '@/util/date'
import { vDraggableCard } from '../directives/draggableCard'

const props = defineProps<{ item: ModpackItem }>()
const emit = defineEmits(['tags', 'delete'])

const { t } = useI18n()
const { showItemInDirectory } = useService(BaseServiceKey)
const { goProjectAndRoute } = useCurseforgeRoute()
const router = useRouter()
const { createTag, editTag, removeTag } = useTags(computed({ get: () => props.item.tags, set(v) { emit('tags', v) } }))
const onDeleteTag = removeTag
const time = computed(() => props.item.resource?.storedDate ? getLocalDateString(props.item.resource?.storedDate) : props.item.ftb ? getLocalDateString(props.item.ftb.updated * 1000) : '')
const contextMenuItems: Ref<ContextMenuItem[]> = computed(() => {
  if (!props.item.resource) {
    if (props.item.ftb) {
      return [{
        text: t('modpack.showInFtb', { name: props.item.name }),
        children: [],
        onClick: () => {
          router.push(`/ftb/${props.item.ftb?.parent}`)
        },
        icon: '$vuetify.icons.ftb',
      }]
    }
    return []
  }
  const items: ContextMenuItem[] = [{
    text: t('tag.create'),
    children: [],
    onClick: () => {
      createTag()
    },
    icon: 'add',
  }, {
    text: t('delete.name', { name: props.item.name }),
    children: [],
    onClick: () => {
      emit('delete')
    },
    icon: 'delete',
    color: 'error',
  }]
  const res = props.item.resource
  items.unshift({
    text: t('modpack.showFile', { file: props.item.resource.path }),
    children: [],
    onClick: () => {
      showItemInDirectory(res.path)
    },
    icon: 'folder',
  })
  if (props.item.resource?.metadata.curseforge) {
    const curseforge = props.item.resource.metadata.curseforge
    items.push({
      text: t('modpack.showInCurseforge', { name: props.item.name }),
      children: [],
      onClick: () => {
        goProjectAndRoute(curseforge.projectId, 'modpacks')
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
</script>
