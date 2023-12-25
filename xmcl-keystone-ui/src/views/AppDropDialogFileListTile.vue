<template>
  <v-list-item
    class="universal-drop-tile"
    color="error"
    @click="tryEnable"
  >
    <v-list-item-avatar>
      <v-icon :size="30">
        {{ value.icon }}
      </v-icon>
    </v-list-item-avatar>
    <v-list-item-content style="">
      <v-list-item-title
        :class="{ 'text-gray-400': disabled }"
      >
        {{ value.title }}
      </v-list-item-title>
      <v-list-item-subtitle>
        {{ value.description }}
      </v-list-item-subtitle>
    </v-list-item-content>
    <v-list-item-action class="flex flex-row items-center justify-end gap-2">
      <v-chip
        v-for="tt of value.type"
        :key="tt"
        label
        small
      >
        {{ tt }}
      </v-chip>
      <v-checkbox
        v-model="enabled"
        style="justify-content: flex-end"
        :disabled="disabled"
        hide-details
      />

      <v-btn
        v-if="value.status === 'idle'"
        icon
      >
        <v-icon
          color="error"
          @click="emit('remove')"
        >
          close
        </v-icon>
      </v-btn>
      <v-progress-circular
        v-else-if="value.status === 'loading'"
        indeterminate
      />
      <v-btn
        v-else-if="value.status === 'saved'"
        readonly
        icon
      >
        <v-icon
          color="green"
        >
          check
        </v-icon>
      </v-btn>

      <v-icon
        v-else
        color="red"
      >
        error_outline
      </v-icon>
    </v-list-item-action>
  </v-list-item>
</template>

<script lang=ts setup>
import { DropItem } from '@/composables/appDropHandler'

const props = defineProps<{ value: DropItem }>()
const emit = defineEmits(['enable', 'remove'])

const { t } = useI18n()
const disabled = computed(() => /* props.value.result?.type === 'unknown' || */
  props.value.status !== 'idle')

const enabled = computed({
  get() { return props.value.enabled },
  set(v) { emit('enable', v) },
})

const tryEnable = () => {
  if (!disabled.value) {
    emit('enable')
  }
}
</script>

<style>
.universal-drop-tile .v-input__slot {
  background: transparent;
  box-shadow: unset;
}
</style>
