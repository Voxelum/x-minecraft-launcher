<template>
  <v-card>
    <v-card-title>
      <v-icon left>
        {{ icon }}
      </v-icon>
      {{ title }}
      {{ t('modpack.name', 1) }}
      <v-spacer />
      <v-btn
        icon
        @click="emit('goto')"
      >
        <v-icon>
          open_in_new
        </v-icon>
      </v-btn>
    </v-card-title>

    <v-card-text>
      <slot />
    </v-card-text>
    <v-card-actions>
      <v-btn
        v-if="status === 3"
        :disabled="refreshing"
        :loading="refreshing"
        text
        @click="emit('fix')"
      >
        <v-icon left>
          build
        </v-icon>
        {{ t('launcherUpdate.reinstall') }}
      </v-btn>
      <v-spacer />
      <v-btn
        :disabled="refreshing || status === 3"
        :loading="refreshing"
        color="teal accent-4"
        text
        @click="emit('update')"
      >
        {{ buttonTexts[status] }}
      </v-btn>
    </v-card-actions>
  </v-card>
</template>
<script lang="ts" setup>
import { UpdateStatus } from '@/composables/instanceUpdate'

defineProps<{
  title: string
  refreshing: boolean
  disabled: boolean
  icon?: string
  status: UpdateStatus
}>()

const buttonTexts = computed(() => ({
  [UpdateStatus.Unchecked]: t('checkUpdate.name'),
  [UpdateStatus.UpdateAvaiable]: t('download'),
  [UpdateStatus.UpdateReady]: t('install'),
  [UpdateStatus.NoUpdate]: t('launcherUpdate.noUpdateAvailable'),
}))

const emit = defineEmits(['update', 'goto', 'fix'])
const { t } = useI18n()
</script>
