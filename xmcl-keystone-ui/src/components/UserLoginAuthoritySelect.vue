<template>
  <v-select
    v-model="selected"
    outlined
    prepend-inner-icon="vpn_key"
    :items="items"
    :label="t('user.authMode')"
    flat
  >
    <template #item="{ item, on, attr }">
      <v-list-item
        v-bind="attr"
        :key="item.value"
        v-on="on"
      >
        <v-list-item-avatar>
          <v-img
            v-if="item.icon.startsWith('http')"
            :src="item.icon"
          />
          <v-icon v-else>
            {{ item.icon }}
          </v-icon>
        </v-list-item-avatar>
        <v-list-item-content>
          <v-list-item-title>
            {{ item.text }}
          </v-list-item-title>
        </v-list-item-content>
      </v-list-item>
    </template>
  </v-select>
</template>
<script setup lang="ts">
import { AuthorityItem } from '@/composables/login'

const props = defineProps<{
  value: string
  items: AuthorityItem[]
}>()
const emit = defineEmits(['input'])

const { t } = useI18n()

const selected = computed<AuthorityItem>({
  get() { return props.items.find(a => a.value === props.value)! },
  set(v) { emit('input', v) },
})

</script>
