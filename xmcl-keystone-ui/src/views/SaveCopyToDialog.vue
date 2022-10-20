<template>
  <v-dialog
    :value="value"
    width="500"
    persistent
  >
    <v-card>
      <v-card-title
        class="headline"
        primary-title
      >
        {{ t('save.copy.title') }}
      </v-card-title>
      <v-card-text>
        {{ t('save.copy.description') }}
      </v-card-text>

      <v-card-text>
        <v-checkbox
          v-for="(p, index) of instances"
          :key="index"
          v-model="selected[index]"
          hide-details
          :label="p"
        />
      </v-card-text>

      <v-divider />
      <v-card-actions>
        <v-spacer />
        <v-btn
          color="error"
          text
          @click="cancel"
        >
          {{ t('save.copy.cancel') }}
        </v-btn>
        <v-btn
          color="primary"
          text
          @click="operate"
        >
          {{ t('save.copy.confirm') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script lang=ts setup>

const props = defineProps<{
  cancel(): void
  operate(instances: string[]): void
  value: string
  instances:string[]
}>()

const { t } = useI18n()
const selected = ref(new Array<string>(props.instances.length))
</script>
