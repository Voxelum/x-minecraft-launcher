<template>
  <v-list
    v-if="false"
    class="base-settings"
    two-line
    subheader
  >
    <v-subheader style="padding-right: 2px">
      {{ t("modpack.name", 1) }}
    </v-subheader>
    <v-list-item>
      <v-list-item-action>
        <v-checkbox
          hide-details
        />
      </v-list-item-action>
      <v-list-item-content>
        <v-list-item-title>
          {{ t("instance.fileApi") }}
        </v-list-item-title>
        <v-list-item-subtitle>
          {{ t("instance.fileApiHint") }}
        </v-list-item-subtitle>
      </v-list-item-content>
      <v-list-item-action style="width: 50%">
        <v-text-field
          v-model="data.fileServerApi"
          hide-details
          placeholder="Please enter the remote sync url here if you want to keep the resource sync"
        />
      </v-list-item-action>
      <v-list-item-action>
        <v-btn
          icon
          text
          @click="gotoHelp"
        >
          <v-icon>question_mark</v-icon>
        </v-btn>
      </v-list-item-action>
    </v-list-item>
  </v-list>
</template>

<script lang="ts" setup>
import { injection } from '@/util/inject'

import { InstanceEditInjectionKey } from '../composables/instanceEdit'

const { data } = injection(InstanceEditInjectionKey)
const { t } = useI18n()
const gotoHelp = () => {
  window.open('https://xmcl.app/faq/', 'browser')
}

</script>

<style scoped="true">
.flex {
  padding: 6px 8px !important
}
.v-btn {
  margin: 0
}
</style>
