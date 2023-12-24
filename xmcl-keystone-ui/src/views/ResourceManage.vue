<template>
  <div class="visible-scroll flex h-full max-h-full select-none flex-col pb-0">
    <v-card
      class="z-5 gap- mx-4 mt-4 rounded-lg"
      outlined
      elevation="1"
    >
      <div class="flex flex-shrink flex-grow-0 items-center p-2">
        <FilterCombobox
          class="max-w-200 max-h-full pr-3"
          :label="t('filter')"
        />
        <div class="flex-grow" />
      </div>
      <div class="w-full">
        <v-tabs
          v-model="tab"
          centered
        >
          <v-tab>
            {{ t('modpack.name') }}
          </v-tab>
          <v-tab>
            {{ t('version.name') }}
          </v-tab>
        </v-tabs>
      </div>
    </v-card>

    <v-tabs-items
      v-model="tab"
      class="h-full overflow-auto bg-transparent"
    >
      <ResourceManageModpack />
      <ResourceManageVersions />
    </v-tabs-items>
  </div>
</template>

<script lang=ts setup>
import FilterCombobox from '@/components/FilterCombobox.vue'
import ResourceManageModpack from './ResourceManageModpack.vue'
import ResourceManageVersions from './ResourceManageVersions.vue'

const tab = ref(0)
const { t } = useI18n()

</script>
