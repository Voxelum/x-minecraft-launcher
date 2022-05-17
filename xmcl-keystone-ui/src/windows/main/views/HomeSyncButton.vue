<template>
  <v-tooltip
    v-if="state.instance.fileApi"
    top
  >
    <template #activator="{ on }">
      <v-badge
        right
        color="primary"
        overlap
        :value="true"
      >
        <template #badge>
          <span>{{ 1 }}</span>
        </template>
        <v-btn
          icon
          :loading="checkingUpdate"
          @click="show()"
          v-on="on"
        >
          <v-icon>import_export</v-icon>
        </v-btn>
      </v-badge>
    </template>
    {{ t('update') }}
  </v-tooltip>
</template>
<script lang="ts" setup>
import { InstanceIOServiceKey, InstanceServiceKey } from '@xmcl/runtime-api'
import { useDialog } from '../composables/dialog'
import { useServiceBusy, useService, useI18n } from '/@/composables'

const { show } = useDialog('instance-sync')
const checkingUpdate = useServiceBusy(InstanceIOServiceKey, 'fetchInstanceUpdate')
const { state } = useService(InstanceServiceKey)
const { t } = useI18n()

</script>

<i18n locale="en" lang="yaml">
update: Sync Instance
</i18n>

<i18n locale="zh-CN" lang="yaml">
update: 更新实例
</i18n>
