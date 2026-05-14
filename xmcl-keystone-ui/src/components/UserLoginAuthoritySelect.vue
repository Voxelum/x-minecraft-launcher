<template>
  <v-select
    v-model="selected"
    variant="outlined"
    density="comfortable"
    rounded="lg"
    prepend-inner-icon="vpn_key"
    :items="items"
    item-title="text"
    item-value="value"
    return-object
    :label="t('user.authMode')"
    flat
  >
    <template #item="{ item, props: itemProps }">
      <v-list-item
        v-bind="itemProps"
        :key="item.value"
        :title="item.text"
      >
        <template #prepend>
          <v-avatar>
            <v-img
              v-if="item.icon.startsWith('http') || item.icon.startsWith('data:')"
              :src="item.icon"
            />
            <v-icon v-else>
              {{ item.icon }}
            </v-icon>
          </v-avatar>
        </template>
      </v-list-item>
    </template>
    <template
      v-if="allowAddService"
      #append-item
    >
      <v-divider />
      <v-list-item
        :title="t('userService.add')"
        @click="$emit('add-service')"
      >
        <template #prepend>
          <v-avatar>
            <v-icon>add</v-icon>
          </v-avatar>
        </template>
      </v-list-item>
    </template>
  </v-select>
</template>
<script setup lang="ts">
import { AuthorityItem, useAllowThirdparty } from '@/composables/login'

const props = defineProps<{
  modelValue: string
  items: AuthorityItem[]
}>()
const emit = defineEmits<{
  (event: 'update:modelValue', value: string): void
  (event: 'add-service'): void
}>()

const { t } = useI18n()

const allowThirdParty = useAllowThirdparty()
const allowAddService = computed(() => allowThirdParty.value)

const selected = computed<AuthorityItem | undefined>({
  get() { return props.items.find(a => a.value === props.modelValue) },
  set(v) {
    if (v) emit('update:modelValue', v.value)
  },
})

</script>
