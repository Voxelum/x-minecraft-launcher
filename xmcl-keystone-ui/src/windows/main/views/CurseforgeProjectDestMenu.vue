<template>
  <v-menu>
    <template #activator="{ on }">
      <v-btn
        block
        :disabled="disabled"
        text
        v-on="on"
      >
        <v-icon left>
          keyboard_arrow_down
        </v-icon>
        <span class="overflow-hidden whitespace-normal break-all lg:max-w-50 max-w-full">
          {{
            selected.path
              ? t("curseforge.installTo", { path: selected.name })
              : selected.name
          }}
        </span>
      </v-btn>
    </template>
    <v-list class="overflow-auto max-h-100">
      <v-list-item @click="onSelect(defaultItem)">
        <v-list-item-avatar>
          <v-icon>close</v-icon>
        </v-list-item-avatar>
        <v-list-item-title>{{ defaultItem.name }}</v-list-item-title>
      </v-list-item>
      <v-list-item
        v-for="(item, index) in items"
        :key="index"
        @click="onSelect(item)"
      >
        <v-list-item-avatar>
          <v-icon>golf_course</v-icon>
        </v-list-item-avatar>
        <v-list-item-title class="flex items-center">
          {{
            t("curseforge.installTo", { path: item.name })
          }}
          <div class="flex-grow" />
          <v-chip
            v-if="selectedPath === item.path"
            color="primary"
            outlined
            label
            small
          >
            {{ t('instance.current') }}
          </v-chip>
        </v-list-item-title>
      </v-list-item>
    </v-list>
  </v-menu>
</template>

<script lang=ts setup>
import { useI18n, useService } from '/@/composables'
import { basename } from '/@/util/basename'
import { InstanceServiceKey } from '@xmcl/runtime-api'

interface Item {
  name: string
  path: string
}

const props = defineProps<{
  value?: string
  from?: string
  disabled?: boolean
}>()

const emit = defineEmits(['input'])

const { state } = useService(InstanceServiceKey)

const instances = computed(() => state.instances)
const selectedPath = computed(() => state.path)
const { t } = useI18n()
const defaultItem = computed(() => ({ name: t('curseforge.installToStorage'), path: '' }))
const items = computed(() => instances.value.map(i => ({ path: i.path, name: i.name || i.runtime.minecraft })).sort((a, b) => !a.path ? -1 : a.path === selectedPath.value ? -1 : 1))
const selected = computed({
  get() {
    const instance = instances.value.find(i => i.path === props.value)
    return instance
      ? { path: instance.path, name: instance.name ?? basename(instance.path) }
      : defaultItem.value
  },
  set(value: Item) {
    if (!value) {
      emit('input', '')
    } else {
      emit('input', value.path)
    }
  },
})
function onSelect(item: Item) {
  selected.value = item
}
</script>

<i18n locale="en" lang="yaml">
curseforge:
  installTo: Install to {path}
  installToStorage: Install to Storage
</i18n>

<i18n locale="zh-CN" lang="yaml">
curseforge:
  installTo: 安装到 {path}
  installToStorage: 安装到库
</i18n>

<i18n locale="zh-TW" lang="yaml">
curseforge:
  installTo: 安裝到 {path}
  installToStorage: 安裝到庫
</i18n>

<i18n locale="ru" lang="yaml">
curseforge:
  installTo: Установить в {path}
  installToStorage: Установить в хранилище
</i18n>
