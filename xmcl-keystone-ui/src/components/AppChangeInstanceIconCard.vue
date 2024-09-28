<script setup lang="ts">
import { useVModel } from '@vueuse/core'

const { t } = useI18n()
const props = defineProps<{
  icon: string
}>()

const emit = defineEmits<{
  (event: 'update:icon', value: string): void
}>()

const iconModel = useVModel(props, 'icon', emit)

function pickIconFile() {
  windowController.showOpenDialog({
    title: t('instanceSetting.icon'),
    filters: [
      {
        name: t('instanceSetting.icon'),
        extensions: ['png', 'jpg', 'jpeg', 'bmp', 'gif'],
      },
    ],
    properties: ['openFile'],
  }).then((result) => {
    if (result.canceled) return
    const filePath = result.filePaths[0]
    if (filePath) {
      iconModel.value = `http://launcher/media?path=${filePath}`
    }
  })
}
</script>

<template>
  <v-card>
    <v-list>
      <v-list-item>
        <v-list-item-content>
          <v-list-item-title>
            {{ t('instance.icon') }}
          </v-list-item-title>
          <v-list-item-subtitle>
            {{ t('instance.iconHint') }}
          </v-list-item-subtitle>
        </v-list-item-content>
        <v-list-item-action>
          <v-btn
            text
            outlined
            @click="iconModel = ''"
          >
            {{ t('modified.reset') }}
          </v-btn>
        </v-list-item-action>
      </v-list-item>
    </v-list>

    <v-divider />

    <v-list>
      <v-list-item>
        <v-text-field
          v-model="iconModel"
          :label="t('instance.iconUrl')"
          small
          hide-details
          outlined
          filled
          dense
        />
        <v-list-item-action>
          <v-btn
            icon
            @click="pickIconFile"
          >
            <v-icon>
              upload_file
            </v-icon>
          </v-btn>
        </v-list-item-action>
      </v-list-item>
    </v-list>
  </v-card>
</template>
