<template>
  <v-menu>
    <template #activator="{ on }">
      <v-btn
        flat
        v-on="on"
      >
        <v-icon left>
          keyboard_arrow_down
        </v-icon>
        {{
          selected.path
            ? $t("curseforge.installTo", { path: selected.name })
            : selected.name
        }}
      </v-btn>
    </template>
    <v-list>
      <v-list-tile @click="onSelect(defaultItem)">
        <v-list-tile-avatar>
          <v-icon> close </v-icon>
        </v-list-tile-avatar>
        <v-list-tile-title>{{ defaultItem.name }}</v-list-tile-title>
      </v-list-tile>
      <v-list-tile
        v-for="(item, index) in items"
        :key="index"
        @click="onSelect(item)"
      >
        <v-list-tile-avatar>
          <v-icon> golf_course </v-icon>
        </v-list-tile-avatar>
        <v-list-tile-title>
          {{
            $t("curseforge.installTo", { path: item.name })
          }}
        </v-list-tile-title>
      </v-list-tile>
    </v-list>
  </v-menu>
</template>

<script lang=ts>
import { useI18n, useInstances } from '/@/hooks'
import { basename } from '/@/util/basename'
import { defineComponent, computed, inject, ref, reactive, toRefs, Ref } from '@vue/composition-api'
import { optional } from '/@/util/props'

interface Item {
  name: string
  path: string
}

export default defineComponent({
  props: {
    value: optional(String),
  },
  setup(props, context) {
    const { instances } = useInstances()
    const { $t } = useI18n()
    const defaultItem: Item = { name: $t('curseforge.installToStorage'), path: '' }
    const items = computed(() => instances.value.map(i => ({ path: i.path, name: i.name ?? basename(i.path) })))
    const selected = computed({
      get() {
        const instance = instances.value.find(i => i.path === props.value)
        return instance
          ? { path: instance.path, name: instance.name ?? basename(instance.path) }
          : defaultItem
      },
      set(value: Item) {
        if (!value) {
          context.emit('input', '')
        } else {
          context.emit('input', value.path)
        }
      },
    })
    function onSelect(item: Item) {
      selected.value = item
    }
    return {
      onSelect,
      defaultItem,
      items,
      selected,
    }
  },
})
</script>
