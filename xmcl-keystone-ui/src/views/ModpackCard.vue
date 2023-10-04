<template>
  <v-card
    v-draggable-card
    v-context-menu="contextMenuItems"
    outlined
    draggable
    hover
    width="250"
    class="draggable-card cursor-pointer rounded-lg transition-all duration-200"
    style="transition: all; transition-duration: 200ms;"
    @dragstart="emit('dragstart')"
    @dragend="emit('dragend')"
  >
    <v-img
      v-if="item.icon"
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
    <div
      v-if="item.tags.length > 0"
      class="flex flex-wrap gap-2 p-2"
    >
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
          @blur="emit('tags', [...item.tags])"
        >
          {{ tag }}
        </div>
      </v-chip>
    </div>
    <v-card-actions>
      <v-btn
        block
        text
        @click="emit('create')"
      >
        <v-icon>
          add
        </v-icon>
      </v-btn>
    </v-card-actions>
  </v-card>
</template>
<script lang="ts" setup>
import { useService, useTags } from '@/composables'
import { getLocalDateString } from '@/util/date'
import { injection } from '@/util/inject'
import { BaseServiceKey } from '@xmcl/runtime-api'
import { Ref } from 'vue'
import { ContextMenuItem } from '../composables/contextMenu'
import { ModpackItem } from '../composables/modpack'
import { kMarketRoute } from '../composables/useMarketRoute'
import { vContextMenu } from '../directives/contextMenu'
import { vDraggableCard } from '../directives/draggableCard'

const props = defineProps<{ item: ModpackItem }>()
const emit = defineEmits(['tags', 'delete', 'dragstart', 'dragend', 'create'])

const { t } = useI18n()
const { showItemInDirectory } = useService(BaseServiceKey)
const { goCurseforgeProject, goModrinthProject } = injection(kMarketRoute)
const router = useRouter()
const { createTag, editTag, removeTag } = useTags(computed({ get: () => props.item.tags, set(v) { emit('tags', v) } }))
const onDeleteTag = removeTag
const time = computed(() => props.item.resource?.storedDate ? getLocalDateString(props.item.resource?.storedDate) : props.item.ftb ? getLocalDateString(props.item.ftb.updated * 1000) : '')
const contextMenuItems: Ref<ContextMenuItem[]> = computed(() => {
  if (!props.item.resource) {
    if (props.item.ftb) {
      return [{
        text: t('modpack.showInFtb', { name: props.item.name }),
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
    onClick: () => {
      createTag()
    },
    icon: 'add',
  }, {
    text: t('delete.name', { name: props.item.name }),
    onClick: () => {
      emit('delete')
    },
    icon: 'delete',
    color: 'error',
  }]
  const res = props.item.resource
  items.unshift({
    text: t('modpack.showFile', { file: props.item.resource.path }),
    onClick: () => {
      showItemInDirectory(res.path)
    },
    icon: 'folder',
  })
  if (props.item.resource?.metadata.curseforge) {
    const curseforge = props.item.resource.metadata.curseforge
    items.push({
      text: t('modpack.showInCurseforge', { name: props.item.name }),
      onClick: () => {
        goCurseforgeProject(curseforge.projectId, 'modpacks')
      },
      icon: '$vuetify.icons.curseforge',
    })
  }
  if (props.item.resource?.metadata.modrinth) {
    const modrinth = props.item.resource.metadata.modrinth
    items.push({
      text: t('modpack.showInModrinth', { name: props.item.name }),
      onClick: () => {
        goModrinthProject(modrinth.projectId)
      },
      icon: '$vuetify.icons.modrinth',
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
