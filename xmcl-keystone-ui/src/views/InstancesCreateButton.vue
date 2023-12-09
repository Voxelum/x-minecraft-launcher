<template>
  <v-btn
    v-shared-tooltip="_ => t('instances.add')"
    text
    @click="showAddInstanceDialog()"
  >
    <v-icon
      left
    >
      add
    </v-icon>
    {{ t('instances.add') }}
  </v-btn>
</template>

<script lang=ts setup>
import { vSharedTooltip } from '@/directives/sharedTooltip'
import { useDialog } from '../composables/dialog'

const { show: showAddInstanceDialog } = useDialog('add-instance-dialog')
const { t } = useI18n()

</script>
