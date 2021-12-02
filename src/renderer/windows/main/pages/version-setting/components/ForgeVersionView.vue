<template>
  <div class="flex h-full flex-col overflow-auto">
    <v-list-tile>
      <v-checkbox v-model="recommendedOnly" :label="$t('forge.recommendedAndLatestOnly')" />
      <v-spacer />
      <v-checkbox v-model="showBuggy" :label="$t('forge.showBuggy')" />
    </v-list-tile>
    <v-divider dark />
    <refreshing-tile v-if="refreshing && versions.length === 0" />
    <v-list
      v-else-if="versions.length !== 0"
      dark
      class="h-full flex flex-col overflow-auto"
      style="background-color: transparent;"
    >
      <v-list-tile ripple @click="select({ version: '' })">
        <v-list-tile-avatar>
          <v-icon>close</v-icon>
        </v-list-tile-avatar>
        {{ $t('forge.disable') }}
      </v-list-tile>
      <virtual-list
        class="h-full overflow-y-auto"
        :data-sources="versions"
        :data-key="'version'"
        :data-component="ForgeVersionListTile"
        :keep="16"
        :extra-props="{ selected: version, select: select, install: install, statuses }"
      />
    </v-list>
    <Hint
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
import ForgeVersionListTile from './ForgeVersionListTile.vue'
import { useForgeVersions } from '/@/hooks'
import { required } from '/@/util/props'
import { ForgeVersion } from '/@shared/entities/version.schema'
import { compareDate } from '/@shared/util/object'
import Hint from '/@/components/Hint.vue'

export default defineComponent({
    props: {
        select: required<(v: {
            version: string;
        }) => void>(Function),
        filterText: required<string>(String),
        minecraft: required<string>(String),
        version: required<string>(String),
    },
    setup(props) {
        const data = reactive({
            recommendedOnly: true,
            showBuggy: false,
        });
        const { statuses, versions: vers, refreshing, refresh, install } = useForgeVersions(computed(() => props.minecraft));
        function filterForge(version: ForgeVersion) {
            if (data.recommendedOnly && version.type !== "recommended" && version.type !== "latest")
                return false;
            if (data.showBuggy && version.type !== "buggy")
                return true;
            return version.version.indexOf(props.filterText) !== -1;
        }
        const versions = computed(() => vers.value.filter(filterForge).sort((a, b) => {
            if (a.date && b.date) {
                return compareDate(new Date(b.date), new Date(a.date));
            }
            return b.version.localeCompare(a.version);
        }).map(v => ({ ...v, status: statuses.value[v.version] })));
        watch(versions, () => {
            if (versions.value.length === 0) {
                data.recommendedOnly = false;
            }
        });
        return {
            ...toRefs(data),
            statuses,
            versions,
            refreshing,
            refresh,
            install,
            ForgeVersionListTile,
        };
    },
    components: { Hint }
})
</script>

<style scoped=true>
/* .flex {
  padding: 6px 8px !important;
} */
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
