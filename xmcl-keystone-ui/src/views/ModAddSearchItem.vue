<template>
  <v-list-item
    v-context-menu="contextMenuItems"
    v-shared-tooltip="item.description || item.title"
    :input-value="selected"
    link
    @click="emit('click')"
  >
    <v-list-item-avatar>
      <v-img
        :src="item.icon"
      />
    </v-list-item-avatar>
    <v-list-item-content>
      <v-list-item-title>{{ item.title }}</v-list-item-title>
      <v-list-item-subtitle>{{ item.description }}</v-list-item-subtitle>
    </v-list-item-content>
    <v-list-item-action class="flex flex-row flex-grow-0">
      <v-avatar
        v-if="item.forge"
        size="30px"
      >
        <v-img
          width="28"
          :src="'image://builtin/forge'"
        />
      </v-avatar>
      <v-avatar
        v-if="item.fabric"
        size="30px"
      >
        <v-img
          width="28"
          :src="'image://builtin/fabric'"
        />
      </v-avatar>
      <v-avatar
        v-if="item.quilt"
        size="30px"
      >
        <v-img
          width="28"
          :src="'image://builtin/quilt'"
        />
      </v-avatar>
      <v-avatar
        size="30px"
      >
        <v-icon>
          {{ item.modrinth ? '$vuetify.icons.modrinth' : item.curseforge ? '$vuetify.icons.curseforge' : 'inventory_2' }}
        </v-icon>
      </v-avatar>
    </v-list-item-action>
  </v-list-item>
</template>

<script lang="ts" setup>
import { ContextMenuItem } from '@/composables/contextMenu'
import { ModListSearchItem } from '@/composables/modSearchItems'
import { kMarketRoute } from '@/composables/useMarketRoute'
import { vContextMenu } from '@/directives/contextMenu'
import { vSharedTooltip } from '@/directives/sharedTooltip'
import { injection } from '@/util/inject'

const props = defineProps<{
  item: ModListSearchItem
  selected: boolean
}>()

const emit = defineEmits(['click'])
const { goCurseforgeProject, goModrinthProject } = injection(kMarketRoute)
const { t } = useI18n()

const contextMenuItems = computed(() => {
  const items: ContextMenuItem[] = []
  const { modrinth, curseforge, title } = props.item
  if (curseforge) {
    items.push({
      text: t('mod.searchOnCurseforge', { name: title }),
      icon: '$vuetify.icons.curseforge',
      onClick: () => {
        goCurseforgeProject(curseforge.id, 'mc-mods')
      },
    })
  }
  if (modrinth) {
    items.push({
      text: t('mod.showInModrinth', { name: title }),
      icon: '$vuetify.icons.modrinth',
      onClick: () => {
        goModrinthProject(modrinth.project_id)
      },
    })
  }
  return items
})
</script>
