<template>
  <div class="flex flex-col overflow-auto h-full">
    <v-list-item class="flex-1 flex-grow-0 flex justify-end">
      <v-checkbox
        v-model="showStableOnly"
        :label="$t('fabric.showStableOnly')"
      />
    </v-list-item>
    <v-divider />
    <v-list
      v-if="fabricSupported"
      class="overflow-hidden"
      style="background-color: transparent;"
    >
      <v-list-item
        ripple
        class="flex-grow-0 flex-1 justify-start"
        @click="select(undefined)"
      >
        <v-list-item-avatar>
          <v-icon>close</v-icon>
        </v-list-item-avatar>
        {{ $t('fabric.disable') }}
      </v-list-item>
      <virtual-list
        ref="list"
        style="overflow-y: auto; scrollbar-width: 0; height: 100%"
        :data-sources="loaderVersions"
        :data-key="'version'"
        :data-component="FabricArtifactVersionListTile"
        :keep="16"
        :extra-props="{ selected: loader, select: select, statuses: getStatus, install: install, minecraft }"
      />
    </v-list>
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
import { required } from '/@/util/props'
import { FabricArtifactVersion } from '@xmcl/installer'
import Hint from '/@/components/Hint.vue'
import FabricArtifactVersionListTile from './VersionFabricArtifactListTile.vue'
import { useFabricVersions } from '../composables/version'

export default defineComponent({
  components: { Hint },
  props: {
    select: required<(v?: {
      version: string
    }) => void>(Function),
    filterText: required<string>(String),
    minecraft: required<string>(String),
    loader: required<string>(String),
  },
  setup(props) {
    const data = reactive({
      showStableOnly: false,
    })
    const { yarnVersions: yv, loaderVersions: lv, yarnStatus, getStatus, install } = useFabricVersions()
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
        props.select({ version: '' })
      } else {
        props.select(v)
      }
    }
    const installFabric = (fab: FabricArtifactVersion) => {
      return install({ minecraft: props.minecraft, loader: fab.version })
    }
    return {
      ...toRefs(data),
      install: installFabric,
      getStatus,
      selectLoader,
      loaderVersions,
      fabricSupported,
      FabricArtifactVersionListTile,
    }
  },
})
</script>

<style scoped=true>
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
