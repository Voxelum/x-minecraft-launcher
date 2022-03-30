<template>
  <div class="flex h-full flex-col">
    <v-divider />
    <refreshing-tile v-if="refreshing && versions.length === 0" />
    <v-list
      v-else-if="versions.length !== 0"

      class="overflow-hidden"
      style="background-color: transparent;"
    >
      <v-list-item
        ripple
        class="justify-start"
        @click="select(undefined)"
      >
        <v-list-item-avatar>
          <v-icon>close</v-icon>
        </v-list-item-avatar>
        {{ $t("optifine.disable") }}
      </v-list-item>
      <virtual-list
        ref="list"
        style="overflow-y: scroll; scrollbar-width: 0; height: 100%"
        :data-sources="versions"
        :data-key="'_id'"
        :data-component="OptifineVersionListTile"
        :keep="16"
        :extra-props="{ selected: version, select: select, statuses, install, minecraft }"
      />
    </v-list>
    <Hint
      v-else
      class="flex-grow"
      icon="refresh"
      :text="$t('optifine.noVersion', { version: minecraft })"
    />
  </div>
</template>

<script lang=ts>
import { computed, defineComponent } from '@vue/composition-api'
import { required } from '/@/util/props'
import { OptifineVersion } from '@xmcl/runtime-api'
import Hint from '/@/components/Hint.vue'
import RefreshingTile from '/@/components/RefreshingTile.vue'
import OptifineVersionListTile from './VersionOptifineListTile.vue'
import { useOptifineVersions } from '../composables/version'

export default defineComponent({
  components: { Hint, RefreshingTile },
  props: {
    select: required<(v: OptifineVersion | undefined) => void>(Function),
    filterText: required<string>(String),
    minecraft: required<string>(String),
    version: required<{
      type: string
      patch: string
    }>(Object),
  },
  setup(props) {
    const { versions, statuses, refreshing, install } = useOptifineVersions(computed(() => props.minecraft))
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
      refreshing,
      statuses,
      install,
      OptifineVersionListTile,
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
