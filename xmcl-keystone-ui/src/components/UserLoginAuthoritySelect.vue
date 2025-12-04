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
    <template
      v-if="allowAddService"
      #append-item
    >
      <v-divider />
      <v-list-item @click="$emit('add-service')">
        <v-list-item-avatar>
          <v-icon>add</v-icon>
        </v-list-item-avatar>
        <v-list-item-content>
          <v-list-item-title>
            {{ t('userService.add') }}
          </v-list-item-title>
        </v-list-item-content>
      </v-list-item>
    </template>
  </v-select>
</template>
<script setup lang="ts">
import { AuthorityItem, useAllowThirdparty } from '@/composables/login'

const props = defineProps<{
  value: string
  items: AuthorityItem[]
}>()
const emit = defineEmits(['input', 'add-service'])

const { t } = useI18n()

const allowThirdParty = useAllowThirdparty()
const allowAddService = computed(() => allowThirdParty.value)

const selected = computed<AuthorityItem>({
  get() { return props.items.find(a => a.value === props.value)! },
  set(v) { emit('input', v) },
})

</script>
