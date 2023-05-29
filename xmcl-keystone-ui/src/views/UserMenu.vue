<template>
  <v-card
    outlined
    class="invisible-scroll user-menu "
  >
    <transition
      name="fade-transition"
      mode="out-in"
    >
      <template
        v-if="!login"
      >
        <div
          :key="0"
        >
          <v-list>
            <UserMenuUserItem
              v-if="selected"
              :user="selected"
              controls
              :refreshing="refreshing"
              @remove="emit('remove')"
              @abort-refresh="emit('abort-refresh')"
              @refresh="emit('refresh')"
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
              @click="login=true"
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
              text
              @click="login = false"
            >
              <v-icon small>arrow_back</v-icon>
            </v-btn>
          </div>

          <div class="flex flex-grow items-center justify-center">
            <AppLoginDialogForm
              :ref="formRef"
              :inside="false"
            />
          </div>
        </div>
      </template>
    </transition>
  </v-card>
</template>
<script lang="ts" setup>
import { AUTHORITY_MICROSOFT, AUTHORITY_MOJANG, UserProfile } from '@xmcl/runtime-api'
import AppLoginDialogForm from './AppLoginDialogForm.vue'
import UserMenuMicrosoft from './UserMenuMicrosoft.vue'
import UserMenuMojang from './UserMenuMojang.vue'
import UserMenuUserItem from './UserMenuUserItem.vue'
import UserMenuYggdrasil from './UserMenuYggdrasil.vue'

const emit = defineEmits(['refresh', 'abort-refresh', 'select', 'remove'])
const { t } = useI18n()
const props = defineProps<{
  selected: UserProfile | undefined
  users: UserProfile[]
  refreshing: boolean
}>()
const login = ref(props.users.length === 0)

const formRef = ref<InstanceType<typeof AppLoginDialogForm> | null>(null)

const reset = (o?: { username?: string; password?: string; microsoftUrl?: string; authority?: string; error?: string }) => {
  formRef.value?.reset(o)
  login.value = false
}

defineExpose({
  reset,
})

const usersToSwitch = computed(() => props.users.filter(v => props.selected ? (v.id !== props.selected.id) : true))
</script>
<style scoped>
.user-menu {
  @apply h-[700px] max-h-[700px] w-[600px] max-w-[600px] overflow-y-auto;
}
</style>
