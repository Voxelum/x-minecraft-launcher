<template>
  <v-menu
    v-model="opened"
    bottom
    dark
    full-width
    :close-on-content-click="false"
    :disabled="disabled"
    style="background-color: #303030; overflow-y: hidden;"
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
      dark
      hide-details
    >
      <template #prepend>
        <v-tooltip top>
          <template #activator="{ on }">
            <v-chip
              :color="showBuggy ? 'green' : ''"
              icon
              dark
              label
              style="margin: 0px; height: 48px; border-radius: 0;"
              @click="showBuggy = !showBuggy"
            >
              <v-icon v-on="on">bug_report</v-icon>
            </v-chip>
          </template>
          {{ $t('version.showSnapshot') }}
        </v-tooltip>
      </template>
    </v-text-field>
    <v-list dark class="h-full flex flex-col overflow-auto">
      <v-list-tile ripple @click="select({ version: '' })">
        <v-list-tile-avatar>
          <v-icon>close</v-icon>
        </v-list-tile-avatar>
        {{ $t('forge.disable') }}
      </v-list-tile>
      <virtual-list
        class="h-full overflow-y-auto max-h-[300px]"
        :data-sources="versions"
        :data-key="'version'"
        :data-component="ForgeVersionMenuTile"
        :keep="16"
        :extra-props="{ select: select }"
      />
    </v-list>
  </v-menu>
</template>

<script lang=ts>
import { reactive, toRefs, defineComponent, computed } from '@vue/composition-api'
import ForgeVersionMenuTile from './ForgeVersionMenuTile.vue'
import { useForgeVersions } from '/@/hooks'
import { ForgeVersion } from '@xmcl/runtime-api'


export default defineComponent({
  props: {
    disabled: {
      type: Boolean,
      default: false,
    },
    minecraft: {
      type: String,
      default: undefined,
    },
  },
  setup(props, context) {
    const data = reactive({
      opened: false,
      showBuggy: true,
      filterText: '',
    })

    function filterForge(version: ForgeVersion) {
      if (!data.showBuggy && version.type !== 'recommended' && version.type !== 'latest') return false
      if (data.filterText.length !== 0) {
        return version.version.indexOf(data.filterText) !== -1
      }
      return true
    }
    const { statuses, versions: vers } = useForgeVersions(computed(() => props.minecraft))
    const versions = computed(() => vers.value.filter(filterForge))

    function selectVersion(item: any) {
      context.emit('input', item)
      data.opened = false
    }
    return {
      ...toRefs(data),
      versions,
      status: statuses,
      select: selectVersion,
      ForgeVersionMenuTile,
    }
  },
})
</script>

<style>
.v-input__prepend-outer {
  margin-top: 0px !important;
  margin-right: 0px !important;
}
.v-input__slot {
  border-radius: 0 !important;
}
</style>
