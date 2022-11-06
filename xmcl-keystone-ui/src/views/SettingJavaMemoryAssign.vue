<template>
  <v-btn-toggle
    v-model="memoryMode"
    dense
  >
    <v-btn>
      <v-icon
        left
      >
        hide_source
      </v-icon>
      {{ t('java.memoryUnassigned') }}
    </v-btn>
    <v-btn>
      <v-icon
        left
        color="primary"
      >
        memory
      </v-icon>
      {{ t('java.memoryAuto') }}
    </v-btn>
    <v-btn>
      <v-icon
        left
        color="deep-orange"
      >
        pinch
      </v-icon>
      {{ t('java.memoryManual') }}
    </v-btn>
  </v-btn-toggle>
</template>

<script lang=ts setup>

const { t } = useI18n()
const props = defineProps<{
  value: boolean | 'auto'
}>()
const emit = defineEmits(['input'])

const memoryMode = computed({
  get() {
    if (props.value === 'auto') return 1
    return props.value ? 2 : 0
  },
  set(v: number) {
    if (v === 0) {
      emit('input', false)
    } else if (v === 1) {
      emit('input', 'auto')
    } else {
      emit('input', true)
    }
  },
})

</script>
