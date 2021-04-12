<template>
  <v-tooltip
    :close-delay="0"
    left
  >
    <template #activator="{ on }">
      <v-speed-dial
        v-if="security"
        v-model="fab"
        class="absolute-centered"
        style="z-index: 3; bottom: 80px; display: flex; justify-content: center"
        direction="top"
        :open-on-hover="true"
      >
        <template #activator>
          <v-btn
            v-model="fab"
            color="secondary"
            :disabled="disabled"
            fab
            v-on="on"
            @click="load"
            @mouseenter="enterEditBtn"
          >
            <v-icon>edit</v-icon>
          </v-btn>
        </template>
        <v-btn
          :disabled="disabled"
          color="secondary"
          fab
          small
          v-on="on"
          @click="upload"
          @mouseenter="enterLinkBtn"
        >
          <v-icon>link</v-icon>
        </v-btn>
        <v-btn
          :disabled="disabled"
          color="secondary"
          fab
          small
          v-on="on"
          @click="save"
          @mouseenter="enterSaveBtn"
        >
          <v-icon>save</v-icon>
        </v-btn>
      </v-speed-dial>
    </template>
    {{ hoverTextOnEdit }}
  </v-tooltip>
</template>

<script lang=ts>
import { defineComponent, reactive, toRefs } from '@vue/composition-api'
import { useI18n } from '/@/hooks'
import { required } from '/@/util/props'

export default defineComponent({
  props: {
    load: required<() => void>(Function),
    upload: required<() => void>(Function),
    save: required<() => void>(Function),
    disabled: required<boolean>(Boolean),
    security: required<boolean>(Boolean),
  },
  setup() {
    const { $t } = useI18n()
    const data = reactive({
      fab: false,
      hoverTextOnEdit: '',
    })
    return {
      ...toRefs(data),
      enterEditBtn() {
        data.hoverTextOnEdit = $t('user.skinImportFile')
      },
      enterLinkBtn() {
        data.hoverTextOnEdit = $t('user.skinImportLink')
      },
      enterSaveBtn() {
        data.hoverTextOnEdit = $t('user.skinSave')
      },
    }
  },
})
</script>

<style>
</style>
