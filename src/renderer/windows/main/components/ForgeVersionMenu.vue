<template>
  <v-menu v-model="opened" bottom dark full-width max-height="300" :close-on-content-click="false"
          :disabled="disabled" style="background-color: #303030">
    <template v-slot:activator="{ on }">
      <slot :on="on" />
    </template>
    <v-text-field v-model="filterText" color="green" append-icon="filter_list" :label="$t('filter')"
                  solo dark hide-details>
      <template v-slot:prepend>
        <v-tooltip top>
          <template v-slot:activator="{ on }">
            <v-chip :color="recommendedAndLatestOnly ? 'green': ''" icon
                    dark label style="margin: 0px; height: 48px; border-radius: 0;" @click="recommendedAndLatestOnly = !recommendedAndLatestOnly">
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
      :recommended-only="recommendedAndLatestOnly" 
      :show-buggy="false" 
      :show-time="false"
      :filter-text="filterText" 
      style="max-height: 180px; background-color: #424242" 
      @input="selectVersion" />
  </v-menu>
</template>

<script lang=ts>
import { reactive, toRefs, defineComponent } from '@vue/composition-api';

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
      recommendedAndLatestOnly: true,
      filterText: '',
    });
    function selectVersion(item: any) {
      context.emit('input', item);
      data.opened = false;
    }
    return {
      ...toRefs(data),
      selectVersion,
    };
  },
});
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
