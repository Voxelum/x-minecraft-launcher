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
          {{ selected.authService }} {{ getLocalDateString(selected.expiredAt) }}
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
        :loading="refreshing"
        @click="emit('refresh')"
      >
        <v-icon left>
          refresh
        </v-icon>
        {{ t('user.refreshAccount') }}
      </v-btn>
      <v-btn
        text
        color="red"
        @click="emit('remove', selected.id)"
      >
        <v-icon left>
          delete
        </v-icon>
        {{ t('userAccount.removeTitle') }}
      </v-btn>
      <v-spacer />
      <v-btn
        outlined
        color="primary"
        class="mr-2"
        text
        @click="emit('addaccount')"
      >
        <v-icon left>
          person_add
        </v-icon>
        {{ t('userAccount.add') }}
      </v-btn>
      <v-menu offset-y>
        <template #activator="{ on }">
          <v-btn
            text
            v-on="on"
          >
            {{ t('userAccount.switch' ) }}
            <v-icon right>
              swap_horiz
            </v-icon>
          </v-btn>
        </template>
        <v-list>
          <v-list-item
            v-for="(item) of users.filter(v => selected ? (v.id !== selected.id) : true)"
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
import { useI18n } from '/@/composables'
import { getLocalDateString } from '/@/util/date'

const emit = defineEmits(['addaccount', 'refresh', 'addservice', 'select', 'remove'])
const { t } = useI18n()
defineProps<{
  selected: UserProfile | undefined
  users: UserProfile[]
  refreshing: boolean
}>()

</script>
