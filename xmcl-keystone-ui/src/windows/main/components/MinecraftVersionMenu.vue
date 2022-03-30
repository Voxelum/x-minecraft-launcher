<template>
  <v-menu
    v-model="opened"
    bottom
    max-height="300"
    :close-on-content-click="false"
    :disabled="disabled"
  >
    <template #activator="{ on }">
      <slot :on="on" />
    </template>
    <v-text-field
      v-model="filterText"
      color="green"
      append-icon="filter_list"
      :label="$t('filter')"
      solo
      hide-details
    >
      <template #prepend>
        <v-tooltip top>
          <template #activator="{ on }">
            <v-chip
              :color="showAlpha ? 'green' : ''"
              icon

              label
              style="margin: 0px; height: 48px; border-radius: 0;"
              @click="showAlpha = !showAlpha"
            >
              <v-icon v-on="on">
                bug_report
              </v-icon>
            </v-chip>
          </template>
          {{ $t("version.showSnapshot") }}
        </v-tooltip>
      </template>
    </v-text-field>
    <v-list class="overflow-auto flex flex-col max-h-[300px]">
      <virtual-list
        ref="list"
        class="overflow-auto flex flex-col"
        :data-key="'id'"
        :data-component="MinecraftVersionMenuTile"
        :data-sources="versions"
        :keep="30"
        :extra-props="{ select: selectVersion }"
      />
    </v-list>
  </v-menu>
</template>

<script lang=ts>
import { defineComponent, reactive, toRefs, computed } from '@vue/composition-api'
import { MinecraftVersion } from '@xmcl/installer'
import { useMinecraftVersions } from '../composables/version'
import MinecraftVersionMenuTile from './MinecraftVersionMenuTile.vue'
import { withDefault } from '/@/util/props'

export default defineComponent({
  props: {
    disabled: withDefault(Boolean, () => false),
    acceptRange: withDefault(String, () => '[*]'),
  },
  setup(props, context) {
    const data = reactive({
      opened: false,
      showAlpha: false,
      filterText: '',
    })
    const { versions, statuses, refreshing } = useMinecraftVersions()
    function filterMinecraft(v: MinecraftVersion) {
      if (!data.showAlpha && v.type !== 'release') return false
      return v.id.indexOf(data.filterText) !== -1
    }
    function selectVersion(item: { id: string }) {
      context.emit('input', item.id)
      data.opened = false
    }
    return {
      ...toRefs(data),
      versions: computed(() => versions.value.filter(filterMinecraft)),
      selectVersion,
      MinecraftVersionMenuTile,
    }
  },
})
</script>

<style>
.v-input__prepend-outer {
  margin-top: 0px !important;
  margin-right: 0px !important;
}
/* .v-input__slot {
  border-radius: 0 !important;
} */
</style>
