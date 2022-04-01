<template>
  <v-treeview
    class="export-dialog-files"
    :value="value"
    style="width: 100%"
    :items="files"
    :open="opened"
    selectable
    hoverable
    activatable
    transition
    open-on-click
    item-children="children"
    @input="$emit('input', $event)"
  >
    <template #prepend="{ item, open, selected }">
      <v-icon
        v-if="item.children"
        :color="selected ? 'accent' : ''"
      >
        {{ open ? 'folder_open' : 'folder' }}
      </v-icon>
      <v-icon v-else>
        insert_drive_file
      </v-icon>
    </template>

    <template #append="{ item, selected }">
      <v-select
        v-if="item.sources.length > 0 && selected"
        v-model="item.source"
        :label="t('profile.modpack.exportFileAs.name')"
        class="w-50"
        :items="(item.sources.concat([''])).map(getSourceItem)"
        hide-details
        flat
      />
    </template>

    <template #label="{ item }">
      <div style="padding: 5px 0px;">
        <span
          style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 250px;"
          :style="{ color: item.disabled ? 'grey' : 'white' }"
        >{{ item.name }}</span>
        <div
          style="color: grey; font-size: 12px; font-style: italic; max-width: 300px;"
        >
          {{ getDescription(item.id) }}
        </div>
        <div
          v-if="item.size > 0"
          style="color: grey; font-size: 12px; font-style: italic; max-width: 300px;"
        >
          {{ item.size > 0 ? getExpectedSize(item.size) : '' }}
        </div>
      </div>
    </template>
  </v-treeview>
</template>

<script lang=ts setup>
import { FileNodesSymbol } from '../composables/instanceExport'
import { useI18n } from '/@/composables'
import { injection } from '/@/util/inject'
import { getExpectedSize } from '/@/util/size'

defineProps<{ value: string[] }>()

const { t } = useI18n()
const opened = ref([])
const getSourceItem = (source: string) => {
  if (source === 'modrinth') return { value: source, text: t('profile.modpack.exportFileAs.modrinth') }
  if (source === 'curseforge') return { value: source, text: t('profile.modpack.exportFileAs.curseforge') }
  if (source === 'github') return { value: source, text: t('profile.modpack.exportFileAs.github') }
  return { value: source, text: t('profile.modpack.exportFileAs.override') }
}
const files = injection(FileNodesSymbol)
function getDescription(path: string) {
  switch (path) {
    case 'mods':
      return t('intro.struct.mods')
    case 'resourcepacks':
      return t('intro.struct.resourcepacks')
    case 'config':
      return t('intro.struct.config')
    case 'saves':
      return t('intro.struct.saves')
    case 'options.txt':
      return t('intro.struct.optionTxt')
    case 'logs':
      return t('intro.struct.logs')
    case 'optionsshaders.txt':
      return t('intro.struct.optionShadersTxt')
    default:
  }
  if (path.startsWith('mods/')) {
    return t('intro.struct.modJar')
  }
  return ''
}
watch(files, () => {
  opened.value = []
})
</script>

<style>
.export-dialog-files
  .v-text-field>.v-input__control>.v-input__slot:before {
  border: none;
}
</style>
