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
          <v-icon>refresh</v-icon>
        </v-btn>
      </v-badge>
    </template>
    更新实例
  </v-tooltip>
</template>
<script lang="ts" setup>
import { InstanceIOServiceKey, InstanceServiceKey } from '@xmcl/runtime-api'
import { useDialog } from '../composables/dialog'
import { useBusy, useService } from '/@/composables'

const { show } = useDialog('instance-sync')
const checkingUpdate = useBusy('getInstanceUpdate()')
const { state } = useService(InstanceServiceKey)

</script>
