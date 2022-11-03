<template>
  <v-card rounded>
    <v-list-item three-line>
      <v-list-item-content>
        <div class="text-overline mb-4">
          {{ t('user.info') }}
        </div>
        <v-list-item-title class="text-h5 mb-1">
          {{ selected ? selected.username : '' }}
        </v-list-item-title>
        <v-list-item-subtitle v-if="selected">
          <div class="flex gap-2 items-baseline mt-2">
            <v-chip
              label
              color="deep orange"
              small
            >
              {{ t('user.authService') }}
            </v-chip>
            {{ selected.authService.toUpperCase() }}
          </div>
          <div class="flex gap-2 items-baseline mt-2">
            <v-chip
              :color="expired ? 'red': 'primary'"
              label
              small
            >
              {{ expired ? t('user.tokenExpired'): t('user.tokenValidUntil') }}
            </v-chip>
            {{ new Date(selected.expiredAt).toLocaleString() }}
          </div>
        </v-list-item-subtitle>
      </v-list-item-content>

      <v-list-item-avatar
        v-if="selected"
        size="80"
      >
        <v-img :src="selected.avatar" />
      </v-list-item-avatar>
    </v-list-item>

    <v-card-actions>
      <v-btn
        text
        :loading="refreshing && !hoverRefresh"
        @mouseenter="hoverRefresh = true"
        @mouseleave="hoverRefresh = false"
        @click="refreshing ? emit('abort-refresh') : emit('refresh')"
      >
        <template v-if="hoverRefresh && refreshing">
          <v-icon
            color="red"
            class="xl:(ml-[4px] mr-[8px]) m-0"
          >
            close
          </v-icon>
        </template>
        <template v-else>
          <v-icon
            class="xl:(ml-[4px] mr-[8px]) m-0"
          >
            refresh
          </v-icon>
          <span class="xl:inline hidden">
            {{ t('user.refreshAccount') }}
          </span>
        </template>
      </v-btn>
      <v-btn
        v-if="selected"
        text
        color="red"
        @click="emit('remove', selected ? selected.id : '')"
      >
        <v-icon
          left
          class="lg:(ml-[4px] mr-[8px]) m-0"
        >
          delete
        </v-icon>
        <span class="lg:inline hidden">
          {{ t('userAccount.removeTitle') }}
        </span>
      </v-btn>
      <v-spacer />
      <v-btn
        outlined
        color="primary"
        class="mr-2"
        text
        @click="emit('login')"
      >
        <v-icon>
          person_add
        </v-icon>
        <span>
          {{ t('userAccount.add') }}
        </span>
      </v-btn>
      <v-menu
        offset-y
      >
        <template #activator="{ on }">
          <v-btn
            text
            :disabled="usersToSwitch.length === 0"
            v-on="on"
          >
            <span class="lg:inline hidden">
              {{ t('userAccount.switch' ) }}
            </span>
            <v-icon
              class="lg:(mr-[4px] ml-[8px]) m-0"
            >
              swap_horiz
            </v-icon>
          </v-btn>
        </template>
        <v-list>
          <v-list-item
            v-for="(item) of usersToSwitch"
            :key="item.id"
            @click="emit('select', item)"
          >
            <v-list-item-content>
              <v-list-item-title class="text-overline">
                {{ item.username }}
              </v-list-item-title>
              <v-list-item-subtitle class="text-overline">
                {{ t('user.authService') }}: {{ item.authService }}
              </v-list-item-subtitle>
            </v-list-item-content>
            <v-list-item-avatar
              v-if="item.avatar"
              :size="48"
            >
              <v-img :src="item.avatar" />
            </v-list-item-avatar>
          </v-list-item>
        </v-list>
      </v-menu>
    </v-card-actions>
  </v-card>
</template>
<script lang="ts" setup>
import { UserProfile } from '@xmcl/runtime-api'

const emit = defineEmits(['login', 'refresh', 'abort-refresh', 'addservice', 'select', 'remove'])
const { t } = useI18n()
const hoverRefresh = ref(false)
const props = defineProps<{
  selected: UserProfile | undefined
  users: UserProfile[]
  refreshing: boolean
  expired: boolean
}>()

const usersToSwitch = computed(() => props.users.filter(v => props.selected ? (v.id !== props.selected.id) : true))

</script>
