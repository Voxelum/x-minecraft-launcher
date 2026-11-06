<template>
  <v-list
    v-if="false"
    class="base-settings"
    two-line
    subheader
  >
    <v-list-subheader style="padding-right: 2px">
      {{ t("modpack.name", 1) }}
    </v-list-subheader>
    <v-list-item>
      <v-list-item-action>
        <v-checkbox
          hide-details
        />
      </v-list-item-action>
      <v-list-item-title>
          {{ t("instance.fileApi") }}
        </v-list-item-title>
        <v-list-item-subtitle>
          {{ t("instance.fileApiHint") }}
        </v-list-item-subtitle>
<v-list-item-action style="width: 50%">
        <v-text-field
          v-model="data.fileServerApi"
          hide-details
          :placeholder="t('instance.fileApiPlaceholder')"
        />
      </v-list-item-action>
      <v-list-item-action>
        <v-btn
          icon
          @click="gotoHelp"
         variant="text">
          <v-icon>question_mark</v-icon>
        </v-btn>
      </v-list-item-action>
    </v-list-item>
    <v-divider />
  </v-list>
</template>

<script lang="ts" setup>
import { injection } from '@/util/inject'
import { VARDRYNN_ISSUES_URL } from '@xmcl/runtime-api'

import { InstanceEditInjectionKey } from '../composables/instanceEdit'

const { data } = injection(InstanceEditInjectionKey)
const { t } = useI18n()
const gotoHelp = () => {
  window.open(VARDRYNN_ISSUES_URL, 'browser')
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
