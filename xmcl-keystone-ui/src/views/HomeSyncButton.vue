<template>
  <v-tooltip
    v-if="instance.fileApi"
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
import { useServiceBusy } from '@/composables'
import { kInstance } from '@/composables/instance'
import { injection } from '@/util/inject'
import { XUpdateServiceKey } from '@xmcl/runtime-api'
import { useDialog } from '../composables/dialog'

const { show } = useDialog('instance-sync')
const checkingUpdate = useServiceBusy(XUpdateServiceKey, 'fetchInstanceUpdate')
const { t } = useI18n()
const { instance } = injection(kInstance)

</script>
