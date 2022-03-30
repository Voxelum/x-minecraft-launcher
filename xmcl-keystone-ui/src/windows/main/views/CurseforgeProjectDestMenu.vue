<template>
  <v-menu>
    <template #activator="{ on }">
      <v-btn
        block
        text
        v-on="on"
      >
        <v-icon left>
          keyboard_arrow_down
        </v-icon>
        <span class="overflow-hidden whitespace-normal break-all w-full">

          {{
            selected.path
              ? $t("curseforge.installTo", { path: selected.name })
              : selected.name
          }}
        </span>
      </v-btn>
    </template>
    <v-list>
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
        <v-list-item-title>
          {{
            $t("curseforge.installTo", { path: item.name })
          }}
        </v-list-item-title>
      </v-list-item>
    </v-list>
  </v-menu>
</template>

<script lang=ts>
import { useI18n } from '/@/composables'
import { basename } from '/@/util/basename'
import { optional } from '/@/util/props'
import { useInstances } from '../composables/instance'

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
    const defaultItem = computed(() => ({ name: $t('curseforge.installToStorage'), path: '' }))
    const items = computed(() => instances.value.map(i => ({ path: i.path, name: i.name ?? basename(i.path) })))
    const selected = computed({
      get() {
        const instance = instances.value.find(i => i.path === props.value)
        return instance
          ? { path: instance.path, name: instance.name ?? basename(instance.path) }
          : defaultItem.value
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
