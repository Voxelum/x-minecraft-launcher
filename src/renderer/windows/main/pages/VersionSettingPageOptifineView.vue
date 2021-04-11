<template>
  <div style="display: flex !important; height: 100%; flex-direction: column">
    <!-- <v-list-tile>
      <v-checkbox
        v-model="showStableOnly"
        :label="$t('fabric.showStableOnly')"
      />
    </v-list-tile> -->
    <v-divider dark />
    <optifine-version-list
      :versions="versions"
      :version="version"
      :select="select"
      :statuses="statuses"
    />
    <!-- <hint
      style="flex-grow: 1"
      icon="refresh"
      :text="$t('fabric.noVersion', { version: minecraft })"
    /> -->
  </div>
</template>

<script lang=ts>
import { defineComponent, reactive, computed, toRefs } from '@vue/composition-api'
import { useOptifineVersions } from '/@/hooks'
import { required } from '/@/util/props'
import { OptifineVersion } from '/@shared/entities/version.schema'

export default defineComponent({
  props: {
    select: required<(v: OptifineVersion | undefined) => void>(Function),
    filterText: required<string>(String),
    minecraft: required<string>(String),
    version: required<OptifineVersion>(Object),
  },
  setup(props) {
    const { versions, statuses } = useOptifineVersions(computed(() => props.minecraft))
    // const loaderVersions = computed(() => lv.value.filter((v) => {
    //   if (data.showStableOnly && !v.stable) {
    //     return false;
    //   }
    //   return true;
    //   // return v.version.indexOf(filterText.value) !== -1;
    // }));
    // const yarnVersions = computed(() => yv.value.filter((v) => {
    //   if (v.gameVersion !== props.minecraft) {
    //     return false;
    //   }
    //   if (data.showStableOnly && !v.stable) {
    //     return false;
    //   }
    //   return true;
    //   // return v.version.indexOf(filterText.value) !== -1;
    // }));

    return {
      versions,
      statuses,
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
