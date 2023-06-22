<template>
  <v-card
    outlined
    class="overflow-y-auto max-h-90vh invisible-scroll"
  >
    <v-list>
      <UserMenuUserItem
        v-if="selected"
        :user="selected"
        controls
        :refreshing="refreshingUser"
        @remove="emit('remove')"
        @abort-refresh="emit('abort-refresh')"
        @refresh="emit('refresh')"
      />
    </v-list>

    <UserMenuMicrosoft
      v-if="selected && selected.authService === 'microsoft'"
      :user="selected"
    />
    <UserMenuMojang
      v-else-if="selected && selected.authService === 'mojang'"
      :user="selected"
    />
    <UserMenuYggdrasil
      v-else-if="!!selected"
      :user="selected"
    />

    <v-divider v-if="usersToSwitch.length > 0" />
    <v-list
      dense
    >
      <UserMenuUserItem
        v-for="(item) of usersToSwitch"
        :key="item.id"
        link
        :user="item"
        @click.native="emit('select', item.id)"
      />
    </v-list>

    <v-divider />
    <v-list
      dense
    >
      <v-list-item
        color="primary"
        @click="showLoginDialog()"
      >
        <v-list-item-avatar>
          <v-icon>
            person_add
          </v-icon>
        </v-list-item-avatar>
        <v-list-item-content>
          <v-list-item-title>
            {{ t('userAccount.add') }}
          </v-list-item-title>
        </v-list-item-content>
      </v-list-item>
    </v-list>
  </v-card>
</template>
<script lang="ts" setup>
import { useDialog } from '@/composables/dialog'
import { LoginDialog } from '@/composables/login'
import { UserProfile, UserServiceKey } from '@xmcl/runtime-api'
import UserMenuUserItem from './UserMenuUserItem.vue'
import UserMenuMicrosoft from './UserMenuMicrosoft.vue'
import UserMenuMojang from './UserMenuMojang.vue'
import UserMenuYggdrasil from './UserMenuYggdrasil.vue'
import { useServiceBusy } from '@/composables'

const emit = defineEmits(['refresh', 'abort-refresh', 'select', 'remove'])
const { t } = useI18n()
const props = defineProps<{
  selected: UserProfile | undefined
  users: UserProfile[]
}>()
const { show: showLoginDialog } = useDialog(LoginDialog)

const usersToSwitch = computed(() => props.users.filter(v => props.selected ? (v.id !== props.selected.id) : true))
const refreshingUser = useServiceBusy(UserServiceKey, 'refreshUser')
</script>
