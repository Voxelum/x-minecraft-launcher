<template>
  <div>
    <ErrorView
      :error="error"
      @refresh="refresh"
    />
    <v-skeleton-loader
      v-if="refreshing"
      type="list-item-avatar-two-line, list-item-avatar-two-line"
    />
    <v-list color="transparent">
      <v-subheader>
        {{ t('modrinth.projectMembers') }}
      </v-subheader>
      <v-list-item
        v-for="m of members"
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
import { useRefreshable, useService } from '@/composables'
import { TeamMember } from '@xmcl/modrinth'
import { ModrinthServiceKey } from '@xmcl/runtime-api'

const props = defineProps<{ projectId: string }>()

const { t } = useI18n()
const { getProjectTeamMembers } = useService(ModrinthServiceKey)
const members = ref([] as TeamMember[])
const { refresh, refreshing, error } = useRefreshable(async () => {
  members.value = await getProjectTeamMembers(props.projectId)
})

const onClick = (u: TeamMember) => {
  const url = `https://modrinth.com/user/${u.user.username}`
  window.location.href = url
}

onMounted(refresh)

</script>
