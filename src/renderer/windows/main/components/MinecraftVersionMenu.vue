<template>
  <v-menu v-model="opened" bottom dark full-width max-height="300" :close-on-content-click="false"
          :disabled="disabled">
    <template v-slot:activator="{ on }">
      <slot :on="on" />
    </template>
    <v-text-field v-model="filterText" color="green" append-icon="filter_list" :label="$t('filter')"
                  solo dark hide-details>
      <template v-slot:prepend>
        <v-tooltip top>
          <template v-slot:activator="{ on }">
            <v-chip :color="showAlpha ? 'green': ''" icon dark label style="margin: 0px; height: 48px; border-radius: 0;"
                    @click="showAlpha = !showAlpha">
              <v-icon v-on="on">
                bug_report
              </v-icon>
            </v-chip>
          </template>
          {{ $t('version.showSnapshot') }}
        </v-tooltip>
      </template>
    </v-text-field>
    <minecraft-version-list 
      :show-time="false" 
      :show-alpha="showAlpha"
      :filter-text="filterText"
      :accept-range="acceptRange"
      style="max-height: 180px; background-color: #424242"
      @input="selectVersion" />
  </v-menu>
</template>

<script lang=ts>
import { createComponent, reactive, toRefs } from '@vue/composition-api';

export default createComponent({
  props: {
    disabled: {
      type: Boolean,
      default: false,
    },
    acceptRange: {
      type: String,
      default: '[*]',
    },
  },
  setup(props, context) {
    const data = reactive({
      opened: false,
      showAlpha: false,
      filterText: '',
    });
    function selectVersion(item: {id: string}) {
      context.emit('input', item.id);
      data.opened = false;
    }
    return {
      ...toRefs(data),
       
      selectVersion,
    };
  },
  methods: {

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
