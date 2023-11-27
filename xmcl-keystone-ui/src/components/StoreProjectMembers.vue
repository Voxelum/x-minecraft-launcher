<template>
  <div>
    <v-subheader>
      {{ t('modrinth.projectMembers') }}
    </v-subheader>
    <ErrorView
      :error="error"
    />
    <v-skeleton-loader
      v-if="loading"
      type="list-item-avatar-two-line, list-item-avatar-two-line"
    />
    <v-list
      v-if="members"
      color="transparent"
      class="xl:(flex-col flex) grid grid-cols-3"
    >
      <v-list-item
        v-for="m of members"
        :key="m.id"
        @click="onClick(m)"
      >
        <v-list-item-avatar>
          <v-img :src="m.avatar" />
        </v-list-item-avatar>
        <v-list-item-content>
          <v-list-item-title v-text="m.name" />
          <v-list-item-subtitle v-text="m.role" />
        </v-list-item-content>
      </v-list-item>
    </v-list>
  </div>
</template>
<script lang="ts" setup>
import ErrorView from '@/components/ErrorView.vue'

export interface TeamMember {
  id: string
  avatar: string
  name: string
  role?: string
  url?: string
}

const props = defineProps<{ members?: TeamMember[]; loading: boolean; error: any }>()

const { t } = useI18n()
const onClick = (u: TeamMember) => {
  if (u.url) {
    window.open(u.url, 'browser')
  }
}

</script>
