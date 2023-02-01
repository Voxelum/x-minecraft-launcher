<template>
  <v-select
    v-model="accountSystemItem"
    outlined
    prepend-inner-icon="vpn_key"
    :items="accountSystemItems"
    :label="t('user.authMode')"
    flat
  />
</template>
<script setup lang="ts">
import { useRefreshable, useService } from '@/composables'
import { UserServiceKey } from '@xmcl/runtime-api'
import { Ref } from 'vue'

const props = defineProps<{
  value: string
}>()
const emit = defineEmits(['input'])

interface ServiceItem {
  text: string
  value: string
}

const getUserServiceName = (serv: string) => {
  if (serv === 'microsoft') return t('userServices.microsoft.name')
  if (serv === 'mojang') return t('userServices.mojang.name')
  if (serv === 'offline') return t('userServices.offline.name')
  return serv
}

const { getSupportedAccountSystems, state } = useService(UserServiceKey)
const { t } = useI18n()
const accountSystems: Ref<string[]> = ref([])
const accountSystemItems: Ref<ServiceItem[]> = computed(() => accountSystems.value
  .map((a) => ({ value: a, text: getUserServiceName(a) })))
const accountSystemItem = computed<ServiceItem>({
  get() { return accountSystemItems.value.find(a => a.value === props.value)! },
  set(v) { emit('input', v) },
})
const { refresh: refreshAccountSystem } = useRefreshable(async () => {
  const systems = await getSupportedAccountSystems()
  accountSystems.value = systems
})
onMounted(refreshAccountSystem)
watch([computed(() => state.yggdrasilServices), computed(() => state.users)], refreshAccountSystem)

</script>
