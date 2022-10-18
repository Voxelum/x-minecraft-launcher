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
        账户信息
      </v-tab>
      <v-tab>
        <v-icon left>
          power
        </v-icon>
        已安装的版本
      </v-tab>
      <v-tab>
        <v-icon left>
          inventory
        </v-icon>
        已下载的整合包
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
