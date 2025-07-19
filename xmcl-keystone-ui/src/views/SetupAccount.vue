<template>
  <div class="relative">
    <div class="select-none px-6 pt-6">
      {{ t('setup.account.description') }}
    </div>

    <v-list
      v-if="!login"
      density="compact"
      class="mt-4"
    >
      <UserCardUserItem
        v-for="(item) of users"
        :key="item.id"
        :user="item"
        @click.native="select(item.id)"
      />
      <v-list-item
        color="primary"
        @click="login = true"
      >
        <template #prepend>
          <v-avatar>
            <v-icon>
              person_add
            </v-icon>
          </v-avatar>
        </template>
        
        <v-list-item-title :title="t('userAccount.add')" />
      </v-list-item>
    </v-list>
    <div
      v-else
      class="flex flex-grow flex-col items-center justify-center"
    >
      <UserLoginForm
        :inside="false"
        @login="login = false"
      >
        <v-btn
          block
          rounded
          size="large"
          class="z-10 mt-4 dark:text-white"
          @click="login = false"
        >
          {{ t('setup.account.skip') }}
        </v-btn>
      </UserLoginForm>
    </div>
  </div>
</template>
<script lang=ts setup>
import UserCardUserItem from '@/components/UserCardUserItem.vue'
import UserLoginForm from '@/components/UserLoginForm.vue'
import { kUserContext } from '@/composables/user'
import { injection } from '@/util/inject'

const { users, select, userProfile: selected } = injection(kUserContext)
const login = ref(false)
const { t } = useI18n()
</script>
