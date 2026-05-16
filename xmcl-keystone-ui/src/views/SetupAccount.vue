<template>
  <div
    data-testid="setup-account"
    class="setup-step-content relative h-full pb-6"
  >
    <div class="select-none px-6 pt-5 text-lg font-semibold">
      {{ t('setup.account.name') }}
    </div>
    <div class="select-none px-6 pt-1 opacity-75">
      {{ t('setup.account.description') }}
    </div>

    <div class="mx-6 mt-5 rounded-2xl border p-3 account-switcher-card">
      <UserAccountSwitcher
        :show-refresh="false"
        density="comfortable"
      />
    </div>

    <div class="px-6 pt-4 flex flex-wrap gap-2">
      <v-btn
        data-testid="setup-account-add"
        color="primary"
        variant="flat"
        rounded="xl"
        @click="openAddAccountDialog"
      >
        <v-icon start>person_add</v-icon>
        {{ t('userAccount.add') }}
      </v-btn>
      <v-btn
        data-testid="setup-account-skip"
        variant="tonal"
        rounded="xl"
        @click="emit('skip')"
      >
        {{ t('setup.account.skip') }}
      </v-btn>
    </div>
  </div>
</template>
<script lang="ts" setup>
import UserAccountSwitcher from '@/components/UserAccountSwitcher.vue'
import { useUserMenuControl } from '@/composables/userMenu'

const { show: showUserProfileDialog } = useUserMenuControl()
const emit = defineEmits<{
  (event: 'skip'): void
}>()
const { t } = useI18n()

function openAddAccountDialog() {
  showUserProfileDialog('login')
}
</script>

<style scoped>
.account-switcher-card {
  border-color: rgba(var(--v-theme-on-surface), 0.08);
  background: rgba(var(--v-theme-on-surface), 0.03);
}
</style>
