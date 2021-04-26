<template>
  <div style="display: flex !important; height: 100%; flex-direction: column;">
    <v-list-tile>
      <v-checkbox
        v-model="recommendedOnly"
        :label="$t('forge.recommendedAndLatestOnly')"
      />
      <v-spacer />
      <v-checkbox
        v-model="showBuggy"
        :label="$t('forge.showBuggy')"
      />
    </v-list-tile>
    <v-divider dark />
    <refreshing-tile v-if="refreshing" />
    <forge-version-list
      v-else-if="versions.length !== 0"
      :value="versions"
      :select="select"
      :status="status"
      :selected="version"
    />
    <hint
      v-else
      v-ripple
      style="flex-grow: 1; cursor: pointer"
      icon="refresh"
      :text="$t('forge.noVersion', { version: minecraft })"
      @click="refresh"
    />
  </div>
</template>

<script lang=ts>
import { defineComponent, reactive, computed, toRefs, watch } from '@vue/composition-api'
import { useForgeVersions } from '/@/hooks'
import { required } from '/@/util/props'
import { ForgeVersion } from '/@shared/entities/version.schema'
import { compareDate } from '/@shared/util/object'

export default defineComponent({
  props: {
    select: required<(v: ForgeVersion | undefined) => void>(Function),
    filterText: required<string>(String),
    minecraft: required<string>(String),
    version: required<string>(String),
  },
  setup(props) {
    const data = reactive({
      recommendedOnly: true,
      showBuggy: false,
    })
    const { statuses, versions: vers, refreshing, refresh } = useForgeVersions(computed(() => props.minecraft))

    function filterForge(version: ForgeVersion) {
      if (data.recommendedOnly && version.type !== 'recommended' && version.type !== 'latest') return false
      if (data.showBuggy && version.type !== 'buggy') return true
      return version.version.indexOf(props.filterText) !== -1
    }

    const versions = computed(() => vers.value.filter(filterForge).sort((a, b) => {
      if (a.date && b.date) {
        return compareDate(new Date(b.date), new Date(a.date))
      }
      return b.version.localeCompare(a.version)
    }))

    watch(versions, () => {
      if (versions.value.length === 0) {
        data.recommendedOnly = false
      }
    })

    return {
      ...toRefs(data),
      status: statuses,
      versions,
      refreshing,
      refresh,
    }
  },
})
</script>

<style scoped=true>
.flex {
  padding: 6px 8px !important;
}
.subtitle {
  color: grey;
  font-size: 14px;
}
.version-tab {
  max-width: 100px;
  min-width: 100px;
}
</style>
<style>
.v-window__container {
  height: 100%;
}
</style>
