<template>
  <v-card
    :outlined="outlined"
    flat
    class="invisible-scroll user-menu"
  >
    <transition
      name="fade-transition"
      mode="out-in"
    >
      <template v-if="!login">
        <div :key="0">
          <v-list>
            <UserCardUserItem
              v-if="selected"
              :user="selected"
              controls
              :hide-user-name="streamerMode"
              :refreshing="refreshing"
              @remove="deleteDialog.show(true)"
              @abort-refresh="abortRefresh()"
              @refresh="onRefresh(true)"
            />
          </v-list>

          <UserCardMicrosoft
            v-if="selected && selected.authority === AUTHORITY_MICROSOFT"
            :user="selected"
          />
          <UserCardYggdrasil
            v-else-if="!!selected"
            :user="selected"
          />

          <v-divider v-if="usersToSwitch.length > 0" />
          <v-list dense>
            <UserCardUserItem
              v-for="(item) of usersToSwitch"
              :key="item.id"
              :hide-user-name="streamerMode"
              link
              :user="item"
              @click.native="onSelectUser(item.id)"
            />
          </v-list>

          <v-divider />
          <v-list dense>
            <v-list-item
              color="primary"
              @click="login = true"
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
        </div>
      </template>
      <template v-else>
        <div
          :key="1"
          class="flex flex-col"
        >
          <div class="relative">
            <v-btn
              v-if="users.length > 0"
              text
              @click="login = false"
            >
              <v-icon small>
                arrow_back
              </v-icon>
            </v-btn>
          </div>

          <div class="flex flex-grow items-center justify-center">
            <UserLoginForm
              :inside="false"
              :options="options"
              @login="reset()"
            />
          </div>
        </div>
      </template>
    </transition>
    <SimpleDialog
      v-model="deleteDialogModel"
      :width="400"
      :title="t('userAccount.removeTitle')"
      @confirm="deleteDialog.confirm"
    >
      {{ t('userAccount.removeDescription') }}
    </SimpleDialog>
  </v-card>
</template>
<script lang="ts" setup>
import SimpleDialog from '@/components/SimpleDialog.vue'
import { useService } from '@/composables'
import { useLocalStorageCacheBool } from '@/composables/cache'
import { useSimpleDialog } from '@/composables/dialog'
import { kUserContext, useUserExpired } from '@/composables/user'
import { injection } from '@/util/inject'
import { AUTHORITY_MICROSOFT, UserServiceKey } from '@xmcl/runtime-api'
import UserCardMicrosoft from './UserCardMicrosoft.vue'
import UserCardUserItem from './UserCardUserItem.vue'
import UserCardYggdrasil from './UserCardYggdrasil.vue'
import UserLoginForm from './UserLoginForm.vue'

const props = defineProps<{ show: boolean; outlined?: boolean }>()

const { t } = useI18n()
const { users, select, userProfile: selected } = injection(kUserContext)
const { abortRefresh, refreshUser, removeUser } = useService(UserServiceKey)
const expired = useUserExpired(computed(() => selected.value))
const deleteDialog = useSimpleDialog<boolean>(async () => {
  const isLastOne = users.value.length <= 1
  await removeUser(selected.value)
  if (isLastOne) {
    login.value = true
  } else {
    select(users.value[0].id)
  }
})
const deleteDialogModel = deleteDialog.model
const streamerMode = inject('streamerMode', useLocalStorageCacheBool('streamerMode', false))

const onSelectUser = (user: string) => {
  select(user)
}
const login = ref(users.value.length === 0)
const refreshing = ref(false)

async function onRefresh(force = false) {
  refreshing.value = true
  try {
    if (users.value.length === 0) {
      login.value = true
      return
    }
    if (!selected.value.id) {
      select(users.value[0].id)
    }
    if (selected.value?.id || selected.value.invalidated || expired.value) {
      // Try to refresh
      const authority = selected.value?.authority
      await refreshUser(selected.value.id, false, force).catch((e) => {
        console.error(e)
        reset({ username: selected.value?.username, authority, error: t('login.userRelogin') })
        login.value = true
      })
    }
  } finally {
    refreshing.value = false
  }
}

watch(() => props.show, (s) => {
  if (!s) return
  onRefresh()
}, { immediate: true })

const options = ref(undefined as any)
const reset = (o?: { username?: string; password?: string; microsoftUrl?: string; authority?: string; error?: string }) => {
  options.value = o
  login.value = false
}

const usersToSwitch = computed(() => users.value.filter(v => selected.value ? (v.id !== selected.value.id) : true))
</script>
