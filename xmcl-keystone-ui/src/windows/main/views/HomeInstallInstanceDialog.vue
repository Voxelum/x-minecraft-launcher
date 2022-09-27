<template>
  <v-dialog v-model="isShown">
    123
  </v-dialog>
</template>

<script lang="ts" setup>
import { useDialog } from '../composables/dialog'

const { isShown, parameter } = useDialog('instance-install')

</script>
