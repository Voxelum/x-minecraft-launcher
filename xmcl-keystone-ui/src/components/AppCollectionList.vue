<template>
  <!-- Inline Modrinth login prompt -->
  <div
    v-if="!userData && !isValidatingUser"
    class="modrinth-login-prompt"
  >
    <v-icon size="64" color="green" class="modrinth-login-prompt__icon">
      xmcl:modrinth
    </v-icon>
    <div class="text-base font-semibold mt-3">
      {{ t('modrinth.loginTitle') }}
    </div>
    <div class="text-sm text-medium-emphasis mt-2 px-4">
      {{ t('modrinth.loginHint') }}
    </div>
    <div class="flex gap-2 mt-5">
      <v-btn
        variant="text"
        size="small"
        @click="onCancelLogin"
      >
        {{ t('shared.no') }}
      </v-btn>
      <v-btn
        color="primary"
        variant="tonal"
        size="small"
        prepend-icon="check"
        @click="onAcceptLogin"
      >
        {{ t('shared.yes') }}
      </v-btn>
    </div>
  </div>

  <!-- Loading state while signing in -->
  <div
    v-else-if="isValidatingUser"
    class="modrinth-login-loading"
  >
    <v-progress-circular indeterminate color="primary" size="36" />
    <div class="text-sm text-medium-emphasis mt-3">
      {{ t('modrinth.loginTitle') }}
    </div>
    <v-btn
      variant="text"
      size="small"
      class="mt-4"
      @click="cancelLogin"
    >
      {{ t('shared.cancel') }}
    </v-btn>
  </div>

  <v-list
    v-else
    nav
    bgColor="transparent"
    class="w-full h-full"
    :selected="[selectedIndex]"
    @update:selected="v => selectedIndex = (v[0] as number) ?? -1"
  >
    <v-list-item v-for="(c, idx) of collectionItems" :key="c.id" :value="idx" color="primary" :title="c.name" :subtitle="c.description" @click="">
      <template #prepend>
        <v-avatar>
          <v-icon v-if="'icon' in c" color="red">{{ c.icon }}</v-icon>
          <v-img v-else-if="c.icon_url" :src="c.icon_url" />
          <div v-else>
            <span class="white--text text-h5 capitalize">{{ c.name[0] }}</span>
          </div>
        </v-avatar>
      </template>
      <v-list-item-subtitle>
        {{ t('modrinth.projects', { count: c.count }) }}
      </v-list-item-subtitle>
      <template v-if="c.id !== 'followed'" #append>
        <v-btn
          icon
          variant="text"
          :loading="deletingCollection === c.id"
          @click.stop="onDeleteCollection(c.id)"
        >
          <v-icon size="small">delete</v-icon>
        </v-btn>
      </template>
    </v-list-item>
    <v-list-item v-if="projectId" color="primary" :title="t('modrinth.createCollection')" @click="show(props.projectId)">
      <template #prepend>
        <v-icon>add</v-icon>
      </template>
    </v-list-item>
  </v-list>
</template>
<script setup lang="ts">
import { useDialog } from '@/composables/dialog';
import { kModrinthAuthenticatedAPI } from '@/composables/modrinthAuthenticatedAPI';
import { injection } from '@/util/inject';

const {
  collections,
  follows,
  deleteCollection,
  userData,
  isValidatingUser,
  acceptSignal,
  rejectSignal,
  cancelLogin,
  interact,
} = injection(kModrinthAuthenticatedAPI)

const props = defineProps<{
  select?: string
  projectId?: string
  noFavorite?: boolean
}>()

const emit = defineEmits(['update:select'])

const deletingCollection = ref<string | null>(null)

async function onDeleteCollection(collectionId: string) {
  deletingCollection.value = collectionId
  try {
    await deleteCollection(collectionId)
    // If the deleted collection was selected, select the followed projects
    if (props.select === collectionId) {
      emit('update:select', 'followed')
    }
  } catch (error) {
    console.error('Failed to delete collection:', error)
  } finally {
    deletingCollection.value = null
  }
}

async function onAcceptLogin() {
  // Make sure interact() is in-flight so it can pick up the resolved signal.
  // `silent: true` prevents the global login dialog from also opening.
  const interactPromise = interact({ silent: true })
  // Yield to ensure interact() has captured the signal before resolving it
  await Promise.resolve()
  acceptSignal()
  await interactPromise
}

function onCancelLogin() {
  rejectSignal()
}

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

<style scoped>
.modrinth-login-prompt,
.modrinth-login-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 32px 16px;
  min-height: 100%;
}

.modrinth-login-prompt__icon {
  opacity: 0.9;
}
</style>
