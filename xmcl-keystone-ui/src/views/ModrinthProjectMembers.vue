<template>
  <div>
    <ErrorView
      :error="error"
    />
    <v-skeleton-loader
      v-if="isValidating"
      type="list-item-avatar-two-line, list-item-avatar-two-line"
    />
    <v-list
      v-if="data"
      color="transparent"
    >
      <v-subheader>
        {{ t('modrinth.projectMembers') }}
      </v-subheader>
      <v-list-item
        v-for="m of data"
        :key="m.user.id"
        @click="onClick(m)"
      >
        <v-list-item-avatar>
          <v-img :src="m.user.avatar_url" />
        </v-list-item-avatar>
        <v-list-item-content>
          <v-list-item-title v-text="m.user.name || m.user.username" />
          <v-list-item-subtitle v-text="m.role" />
        </v-list-item-content>
      </v-list-item>
    </v-list>
  </div>
</template>
<script lang="ts" setup>
import ErrorView from '@/components/ErrorView.vue'
import { kSWRVConfig } from '@/composables/swrvConfig'
import { clientModrinthV2 } from '@/util/clients.js'
import { TeamMember } from '@xmcl/modrinth'
import useSWRV from 'swrv'

const props = defineProps<{ projectId: string }>()

const { t } = useI18n()
const { isValidating, error, data } = useSWRV(computed(() => `/modrinth/team/${props.projectId}`),
  () => clientModrinthV2.getProjectTeamMembers(props.projectId),
  inject(kSWRVConfig),
)

const onClick = (u: TeamMember) => {
  const url = `https://modrinth.com/user/${u.user.username}`
  window.open(url, 'browser')
}

</script>
