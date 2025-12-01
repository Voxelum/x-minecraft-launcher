<template>
  <v-dialog
    v-model="isShown"
    :persistent="false"
    :width="450"
  >
    <v-card>
      <v-card-title
        class="headline"
        primary-title
      >
        {{ t('modInstall.autoUpgrade.title') }}
      </v-card-title>

      <v-card-text>
        {{ t('modInstall.autoUpgrade.description', { version: minecraftVersion }) }}
      </v-card-text>

      <v-divider />
      <v-card-actions>
        <v-btn
          text
          @click="onSkip"
        >
          {{ t('modInstall.autoUpgrade.no') }}
        </v-btn>
        <v-spacer />
        <v-btn
          color="primary"
          @click="onUpgrade"
        >
          <v-icon left>
            upgrade
          </v-icon>
          {{ t('modInstall.autoUpgrade.yes') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script lang="ts" setup>
import { useDialog } from '../composables/dialog'
import { BaseSettingModUpgradeDialogKey } from '../composables/instanceUpdate'

const emit = defineEmits<{
  (e: 'upgrade'): void
  (e: 'skip'): void
}>()

const { t } = useI18n()
const minecraftVersion = ref('')

const { isShown, parameter } = useDialog(BaseSettingModUpgradeDialogKey)

watch(isShown, (shown) => {
  if (shown && parameter.value) {
    minecraftVersion.value = parameter.value.minecraftVersion
  }
})

function onSkip() {
  isShown.value = false
  emit('skip')
}

function onUpgrade() {
  isShown.value = false
  emit('upgrade')
}
</script>
