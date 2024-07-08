<template>
  <v-list dense>
    <!-- <v-list-item @click>
      <v-list-item-title>
        Check integrety
      </v-list-item-title>
    </v-list-item> -->
    <v-list-item @click="onStartLocalhost">
      <v-list-item-avatar size="20">
        <v-icon size="20">
          dns
        </v-icon>
      </v-list-item-avatar>
      <v-list-item-title>
        {{ t('instance.launchServer') }}
      </v-list-item-title>
    </v-list-item>
  </v-list>
</template>
<script lang="ts" setup>
import { useDialog } from '@/composables/dialog'

const { t } = useI18n()
defineProps<{ }>()

const { show } = useDialog('launch-server')
const onStartLocalhost = async () => {
  show()
}
</script>
