<template>
  <v-tooltip
    :close-delay="0"
    left
  >
    <template #activator="{ on }">
      <v-fab-transition>
        <v-btn
          v-if="visible"
          class="absolute-centered"
          style="z-index: 3; bottom: 40px"
          :color="deleting ? 'error' : 'green'"
          fab
          large
          v-on="on"
          @dragover.prevent
          @mouseenter="enterEditBtn"
          @drop="emit('drop', $event)"
          @click="emit('click', $event)"
        >
          <v-icon
            v-if="deleting"
            :key="0"
            color="white"
          >
            delete
          </v-icon>
          <v-icon
            v-else
            :key="1"
            color="white"
          >
            compare_arrows
          </v-icon>
        </v-btn>
      </v-fab-transition>
    </template>
    {{ t('userAccount.switch') }}
  </v-tooltip>
</template>

<script lang=ts setup>

const emit = defineEmits(['drop', 'click'])

defineProps<{
  visible: boolean
  deleting: boolean
  loading: boolean
}>()

const { t } = useI18n()
const data = reactive({
  fab: false,
  hoverTextOnEdit: '',
})
function enterEditBtn() {
  data.hoverTextOnEdit = t('userSkin.importFile')
}
function enterLinkBtn() {
  data.hoverTextOnEdit = t('userSkin.importLink')
}
function enterSaveBtn() {
  data.hoverTextOnEdit = t('userSkin.save')
}
</script>

<style>
</style>
