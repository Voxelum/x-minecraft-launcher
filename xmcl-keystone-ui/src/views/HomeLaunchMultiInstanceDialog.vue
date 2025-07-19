<template>
  <v-dialog
    v-model="isShown"
    :width="500"
    persistent
  >
    <v-alert
      density="compact"
      border="start"
      type="warning"
      prominent
    >
      <v-card
        elevation="0"
        text
        color="transparent"
      >
        <v-card-title>
          {{ t('HomeLaunchMultiInstanceDialog.title') }}
        </v-card-title>
        <v-card-text>
          {{ t('HomeLaunchMultiInstanceDialog.description') }}
        </v-card-text>
        <v-card-actions>
          <v-btn
            variant="text"
            @click="isShown = false"
          >
            {{ t('cancel') }}
          </v-btn>
          <v-spacer />
          <v-btn
            variant="text"
            @click="launch(); isShown = false"
          >
            {{ t('HomeLaunchMultiInstanceDialog.confirm') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-alert>
  </v-dialog>
</template>

<script lang=ts setup>
import { kInstanceLaunch } from '@/composables/instanceLaunch'
import { injection } from '@/util/inject'
import { useDialog } from '../composables/dialog'

const { t } = useI18n()
const { isShown } = useDialog('multi-instance-launch')
const { launch } = injection(kInstanceLaunch)
</script>
