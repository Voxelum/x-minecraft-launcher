<template>
  <v-menu
    v-model="opened"
    bottom
    dark
    full-width
    max-height="300"
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
              :color="recommendedAndLatestOnly ? 'green': ''"
              icon
              dark
              label
              style="margin: 0px; height: 48px; border-radius: 0;"
              @click="recommendedAndLatestOnly = !recommendedAndLatestOnly"
            >
              <v-icon v-on="on">
                bug_report
              </v-icon>
            </v-chip>
          </template>
          {{ $t('version.showSnapshot') }}
        </v-tooltip>
      </template>
    </v-text-field>
    <forge-version-list
      :minecraft="minecraft"
      :value="versions"
      :status="status"
      :select="select"
      :selected="''"
      style="max-height: 180px; background-color: #424242; display: flex; flex-direction: column;"
    />
  </v-menu>
</template>

<script lang=ts>
import { reactive, toRefs, defineComponent, computed } from '@vue/composition-api'
import { useForgeVersions } from '/@/hooks'
import { ForgeVersion } from '/@shared/entities/version.schema'

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
      showBuggy: false,
      recommendedAndLatestOnly: false,
      filterText: '',
    })

    function filterForge(version: ForgeVersion) {
      if (data.recommendedAndLatestOnly && version.type !== 'recommended' && version.type !== 'latest') return false
      if (data.showBuggy && version.type !== 'buggy') return true
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
