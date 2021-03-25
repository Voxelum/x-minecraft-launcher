<template>
  <div style="display: flex !important; height: 100%; flex-direction: column">
    <v-list-tile>
      <v-checkbox
        v-model="showStableOnly"
        :label="$t('fabric.showStableOnly')"
      />
    </v-list-tile>
    <v-divider dark />
    <fabric-artifact-version-list
      v-if="fabricSupported"
      :versions="loaderVersions"
      :version="loader"
      :statuses="loaderStatus"
      :select="selectLoader"
    />
    <hint
      v-else
      style="flex-grow: 1"
      icon="refresh"
      :text="$t('fabric.noVersion', { version: minecraft })"
    />
  </div>
</template>

<script lang=ts>
import { defineComponent, reactive, computed, toRefs } from '@vue/composition-api'
import {
  useFabricVersions,
} from '/@/hooks'
import { required } from '/@/util/props'
import { FabricArtifactVersion } from '@xmcl/installer'

export default defineComponent({
  props: {
    select: required<(v: string | undefined) => void>(Function),
    filterText: required<string>(String),
    minecraft: required<string>(String),
    loader: required<string>(String),
  },
  setup(props) {
    const data = reactive({
      showStableOnly: false,
    })

    const { yarnVersions: yv, loaderVersions: lv, yarnStatus, loaderStatus } = useFabricVersions()
    const loaderVersions = computed(() => lv.value.filter((v) => {
      if (data.showStableOnly && !v.stable) {
        return false
      }
      return true
      // return v.version.indexOf(filterText.value) !== -1;
    }))
    const yarnVersions = computed(() => yv.value.filter((v) => {
      if (v.gameVersion !== props.minecraft) {
        return false
      }
      if (data.showStableOnly && !v.stable) {
        return false
      }
      return true
      // return v.version.indexOf(filterText.value) !== -1;
    }))
    const fabricSupported = computed(() => !!yarnVersions.value.find(v => v.gameVersion === props.minecraft))
    const selectLoader = (v: FabricArtifactVersion) => {
      if (!v.version) {
        props.select('')
      } else {
        props.select(v.version)
      }
    }

    return {
      ...toRefs(data),
      selectLoader,
      loaderVersions,
      fabricSupported,
      loaderStatus,
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
