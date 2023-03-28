<template>
  <v-card
    outlined
  >
    <v-list>
      <UserHeaderUserItem
        v-if="selected"
        :user="selected"
        controls
        @remove="emit('remove')"
        @abort-refresh="emit('abort-refresh')"
        @refresh="emit('refresh')"
      />
    </v-list>

    <UserMicrosoftView
      v-if="selected && selected.authService === 'microsoft'"
      class="w-full"
      :user="selected"
    />
    <UserMojangView
      v-else-if="selected && selected.authService === 'mojang'"
      class="w-full"
      :user="selected"
    />
    <UserYggdrasilView
      v-else-if="!!selected"
      class="w-full"
      :user="selected"
    />

    <v-divider />
    <v-list
      dense
    >
      <UserHeaderUserItem
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
import { UserProfile } from '@xmcl/runtime-api'
import UserHeaderUserItem from './UserHeaderUserItem.vue'
import UserMicrosoftView from './UserMicrosoftView.vue'
import UserMojangView from './UserMojangView.vue'
import UserYggdrasilView from './UserYggdrasilView.vue'

const emit = defineEmits(['refresh', 'abort-refresh', 'select', 'remove'])
const { t } = useI18n()
const props = defineProps<{
  selected: UserProfile | undefined
  users: UserProfile[]
  refreshing: boolean
  expired: boolean
}>()
const { show: showLoginDialog } = useDialog(LoginDialog)

const usersToSwitch = computed(() => props.users.filter(v => props.selected ? (v.id !== props.selected.id) : true))

</script>
