<template>
  <v-list nav>
    <v-list-item-group :input-value="selectedIndex" :value="selectedIndex" color="primary"
      @change="selectedIndex = $event">
      <v-list-item v-for="c of collectionItems" :key="c.id" @click="">
        <v-list-item-avatar>
          <v-icon v-if="'icon' in c" color="red">{{ c.icon }}</v-icon>
          <v-img v-else-if="c.icon_url" :src="c.icon_url" />
          <div v-else>
            <span class="white--text text-h5 capitalize">{{ c.name[0] }}</span>
          </div>
        </v-list-item-avatar>
        <v-list-item-content>
          <v-list-item-title>
            {{ c.name }}
          </v-list-item-title>
          <v-list-item-subtitle>
            {{ c.description }}
          </v-list-item-subtitle>
          <v-list-item-subtitle>
            {{ t('modrinth.projects', { count: c.count }) }}
          </v-list-item-subtitle>
        </v-list-item-content>
      </v-list-item>
    </v-list-item-group>
    <v-list-item v-if="projectId" color="primary" @click="show(props.projectId)">
      <v-list-item-icon>
        <v-icon>add</v-icon>
      </v-list-item-icon>
      <v-list-item-content>
        <v-list-item-title>
          {{ t('modrinth.createCollection') }}
        </v-list-item-title>
      </v-list-item-content>
    </v-list-item>
  </v-list>
</template>
<script setup lang="ts">
import { useDialog } from '@/composables/dialog';
import { kModrinthAuthenticatedAPI } from '@/composables/modrinthAuthenticatedAPI';
import { injection } from '@/util/inject';

const { collections, follows } = injection(kModrinthAuthenticatedAPI)

const props = defineProps<{
  select?: string
  projectId?: string
  noFavorite?: boolean
}>()

const emit = defineEmits(['update:select'])

const selectedIndex = computed({
  get() {
    const noOffset = props.noFavorite
    if (noOffset) {
      return collections.value?.findIndex(c => c.id === props.select) || -1
    }
    const idx = collections.value?.findIndex(c => c.id === props.select)
    if (idx === -1 || idx === undefined) {
      return 0
    }
    return idx + 1
  },
  set(index) {
    const noOffset = props.noFavorite
    if (noOffset) {
      emit('update:select', collections.value?.[index]?.id)
      return
    }
    if (index === 0) {
      emit('update:select', 'followed')
    } else {
      emit('update:select', collections.value?.[index - 1]?.id)
    }
  },
})

const collectionItems = computed(() => {
  return props.noFavorite
    ? collections.value?.map(c => ({
      id: c.id,
      name: c.name,
      description: c.description,
      icon_url: c.icon_url,
      count: c.projects.length,
    })) || []
    : [
      {
        id: 'followed',
        name: t('modrinth.followedProjects'),
        description: '',
        icon_url: undefined,
        icon: 'favorite',
        count: follows.value?.length || 0,
      },
      ...(collections.value?.map(c => ({
        id: c.id,
        name: c.name,
        description: c.description,
        icon_url: c.icon_url,
        count: c.projects.length,
      })) || []),
    ]
})

const { t } = useI18n()
const { show } = useDialog('collection')

</script>