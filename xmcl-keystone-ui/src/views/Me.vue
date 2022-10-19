<template>
  <div
    class="flex flex-col h-full overflow-auto w-full me max-h-full"
    @dragover.prevent
  >
    <v-tabs
      class="h-full overflow-auto"
      vertical
    >
      <v-tab>
        <v-icon left>
          manage_accounts
        </v-icon>
        {{ t('user.info') }}
      </v-tab>
      <v-tab>
        <v-icon left>
          power
        </v-icon>
        {{ t('localVersion.title') }}
      </v-tab>
      <v-tab>
        <v-icon left>
          inventory
        </v-icon>
        {{ t('modpack.name', 2) }}
      </v-tab>
      <v-tab-item
        class="h-full overflow-auto"
        transition="slide-y-transition"
      >
        <User class="h-full" />
      </v-tab-item>
      <v-tab-item
        class="h-full overflow-auto"
        transition="slide-y-transition"
      >
        <VersionLocalView
          :value="EMPTY_VERSION"
          :filter-text="filterText"
        />
      </v-tab-item>
      <v-tab-item transition="slide-y-transition">
        <Modpack />
      </v-tab-item>
    </v-tabs>
  </div>
</template>

<script lang=ts setup>
import { EMPTY_VERSION } from '@xmcl/runtime-api'
import Modpack from './Modpack.vue'
import User from './User.vue'
import VersionLocalView from './VersionLocalView.vue'

const filterText = ref('')
const { t } = useI18n()
</script>

<style>

.me .theme--dark.v-tabs-items {
  background-color: transparent;
}
.me .v-window__container {
  height: 100%;
}

.me .v-tabs-items {
  background: transparent !important;
  background-color: transparent !important;
}
</style>
