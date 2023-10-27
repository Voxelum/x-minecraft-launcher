<template>
  <v-card
    outlined
    class="invisible-scroll user-menu "
  >
    <transition
      name="fade-transition"
      mode="out-in"
    >
      <template v-if="!login">
        <div :key="0">
          <v-list>
            <UserMenuUserItem
              v-if="selected"
              :user="selected"
              controls
              :refreshing="refreshing"
              @remove="onRemoveUser()"
              @abort-refresh="abortRefresh()"
              @refresh="onRefresh()"
            />
          </v-list>

          <UserMenuMicrosoft
            v-if="selected && selected.authority === AUTHORITY_MICROSOFT"
            :user="selected"
          />
          <UserMenuMojang
            v-else-if="selected && selected.authority === AUTHORITY_MOJANG"
            :user="selected"
          />
          <UserMenuYggdrasil
            v-else-if="!!selected"
            :user="selected"
          />

          <v-divider v-if="usersToSwitch.length > 0" />
          <v-list dense>
            <UserMenuUserItem
              v-for="(item) of usersToSwitch"
              :key="item.id"
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
            <AppLoginForm
              :inside="false"
              :options="options"
              @login="reset()"
            />
          </div>
        </div>
      </template>
    </transition>
  </v-card>
</template>
<script lang="ts" setup>
import { useRefreshable, useService } from '@/composables'
import { kUserContext, useUserExpired } from '@/composables/user'
import { injection } from '@/util/inject'
import { AUTHORITY_MICROSOFT, AUTHORITY_MOJANG, UserServiceKey } from '@xmcl/runtime-api'
import AppLoginForm from './AppLoginForm.vue'
import UserMenuMicrosoft from './UserMenuMicrosoft.vue'
import UserMenuMojang from './UserMenuMojang.vue'
import UserMenuUserItem from './UserMenuUserItem.vue'
import UserMenuYggdrasil from './UserMenuYggdrasil.vue'

const { t } = useI18n()
const { users, select, userProfile: selected } = injection(kUserContext)
const { abortRefresh, refreshUser, removeUser } = useService(UserServiceKey)
const expired = useUserExpired(computed(() => selected.value))

const props = defineProps<{ show: boolean }>()

const onSelectUser = (user: string) => {
  select(user)
}
const login = ref(users.value.length === 0)
const { refresh: onRefresh, refreshing, error } = useRefreshable(async () => {
  if (users.value.length === 0) {
    login.value = true
  } else {
    if (!selected.value.id) {
      select(users.value[0].id)
    }
    if (selected.value?.id || selected.value.invalidated || expired.value) {
      // Try to refresh
      const authority = selected.value?.authority
      await refreshUser(selected.value.id).catch((e) => {
        console.error(e)
        reset({ username: selected.value?.username, authority, error: t('login.userRelogin') })
        login.value = true
      })
    }
  }
})

watch(() => props.show, (s) => {
  if (!s) return
  onRefresh()
}, { immediate: true })

async function onRemoveUser() {
  const isLastOne = users.value.length <= 1
  await removeUser(selected.value)
  if (isLastOne) {
    login.value = true
  } else {
    select(users.value[0].id)
  }
}

const options = ref(undefined as any)
const reset = (o?: { username?: string; password?: string; microsoftUrl?: string; authority?: string; error?: string }) => {
  options.value = o
  login.value = false
}

const usersToSwitch = computed(() => users.value.filter(v => selected.value ? (v.id !== selected.value.id) : true))
</script>
<style scoped>
.user-menu {
  @apply h-[700px] max-h-[700px] w-[600px] max-w-[600px] overflow-y-auto;
}
</style>
