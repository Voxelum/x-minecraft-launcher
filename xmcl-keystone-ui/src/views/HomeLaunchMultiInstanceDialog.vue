<template>
  <v-dialog
    v-model="isShown"
    :width="500"
    persistent
  >
    <v-alert
      dense
      border="left"
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
            text
            @click="isShown = false"
          >
            {{ t('cancel') }}
          </v-btn>
          <v-spacer />
          <v-btn
            text
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
import { useDialog } from '../composables/dialog'
import { useLaunch } from '../composables/launch'

const { t } = useI18n()
const { isShown } = useDialog('multi-instance-launch')

const { launch } = useLaunch()
</script>
