<template>
  <v-list-item
    v-context-menu.force="contextMenuItems"
    width="250"
    class="select-text rounded-lg transition-all duration-200"
    style="transition: all; transition-duration: 200ms;"
    @click="item.resource ? showItemInDirectory(item.resource.path) : undefined"
  >
    <v-list-item-avatar>
      <v-img
        v-if="item.icon"
        :src="item.icon"
      >
        <template #placeholder>
          <v-skeleton-loader type="image" />
        </template>
      </v-img>
    </v-list-item-avatar>

    <v-list-item-content>
      <v-list-item-title>{{ item.name }}</v-list-item-title>
      <v-list-item-subtitle class="flex items-center gap-2">
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
        <v-chip
          v-for="(tag, index) in item.tags"
          :key="tag"
          small
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
      </v-list-item-subtitle>
    </v-list-item-content>
    <v-list-item-action>
      <v-btn
        icon
        color="red"
        text
        @click.stop="emit('delete')"
      >
        <v-icon>
          delete
        </v-icon>
      </v-btn>
    </v-list-item-action>
    <v-list-item-action>
      <v-btn
        icon
        text
        @click.stop="emit('create')"
      >
        <v-icon>
          add
        </v-icon>
      </v-btn>
    </v-list-item-action>
  </v-list-item>
</template>
<script lang="ts" setup>
import { useService, useTags } from '@/composables'
import { getLocalDateString } from '@/util/date'
import { injection } from '@/util/inject'
import { BaseServiceKey } from '@xmcl/runtime-api'
import { Ref } from 'vue'
import { ContextMenuItem } from '../composables/contextMenu'
import { ModpackItem } from '../composables/modpack'
import { vContextMenu } from '../directives/contextMenu'

const props = defineProps<{ item: ModpackItem }>()
const emit = defineEmits(['tags', 'delete', 'dragstart', 'dragend', 'create'])

const { t } = useI18n()
const { showItemInDirectory } = useService(BaseServiceKey)
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
  // if (props.item.resource?.metadata.curseforge) {
  //   const curseforge = props.item.resource.metadata.curseforge
  //   items.push({
  //     text: t('modpack.showInCurseforge', { name: props.item.name }),
  //     onClick: () => {
  //       goCurseforgeProject(curseforge.projectId, 'modpacks')
  //     },
  //     icon: '$vuetify.icons.curseforge',
  //   })
  // }
  // if (props.item.resource?.metadata.modrinth) {
  //   const modrinth = props.item.resource.metadata.modrinth
  //   items.push({
  //     text: t('modpack.showInModrinth', { name: props.item.name }),
  //     onClick: () => {
  //       goModrinthProject(modrinth.projectId)
  //     },
  //     icon: '$vuetify.icons.modrinth',
  //   })
  // }
  return items
})
function onEditTag(event: Event, index: number) {
  if (event.target instanceof HTMLDivElement) {
    editTag(event.target.innerText, index)
  }
}
</script>
