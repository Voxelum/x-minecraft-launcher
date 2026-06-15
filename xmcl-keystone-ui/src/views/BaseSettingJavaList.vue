<template>
  <v-list lines="two" class="bg-transparent py-0">
    <v-list-item
      key="DEFAULT"
      :active="value.path === ''"
      color="primary"
      @click="emit('input', { path: '', version: '', majorVersion: 0, valid: false })"
    >
      <template #prepend>
        <v-avatar variant="tonal" rounded="lg">
          <v-icon>auto_awesome</v-icon>
        </v-avatar>
      </template>
      <v-list-item-title>
        {{ t('java.allocatedLong') }}
      </v-list-item-title>
      <v-list-item-subtitle v-if="java?.path">{{ java.path }}</v-list-item-subtitle>
      <v-list-item-subtitle v-else-if="autoIssue === 'no-java'" class="text-error">
        {{ t('HomeJavaIssueDialog.missingJava') }}
      </v-list-item-subtitle>
      <v-list-item-subtitle v-else-if="autoIssue === 'no-match'" class="text-warning">
        {{ t('launchNoProperJava.title') }} — {{ t('installJre.name') }}
      </v-list-item-subtitle>
    </v-list-item>

    <v-divider />

    <v-list-item
      v-for="item in items"
      :key="item.path"
      :active="item.path === value.path"
      :color="item.valid ? 'primary' : 'error'"
      @click="emit('input', item)"
    >
      <template #prepend>
        <v-avatar
          rounded="lg"
          :color="item.path === value.path && item.valid ? 'primary' : (item.valid ? 'orange' : 'grey')"
          :variant="item.path === value.path && item.valid ? 'flat' : 'tonal'"
        >
          <span class="font-weight-bold">
            {{ item.majorVersion || '?' }}
          </span>
        </v-avatar>
      </template>

      <v-list-item-title v-if="item.valid" class="flex items-center gap-2">
        Java {{ item.version }}
        <v-chip
          v-if="item.arch"
          class="h-[20px]"
          color="orange"
          size="small"
          label
          variant="outlined"
        >
          {{ item.arch }}
        </v-chip>
      </v-list-item-title>
      <v-list-item-title v-else>
        {{ t('java.invalid') }}
      </v-list-item-title>
      <v-list-item-subtitle>{{ item.path }}</v-list-item-subtitle>

      <template #append>
        <v-btn
          v-if="item.valid"
          v-shared-tooltip="() => t('java.openFolder')"
          icon
          variant="text"
          density="comfortable"
          size="small"
          @click.stop="showItemInDirectory(item.path)"
        >
          <v-icon>folder_open</v-icon>
        </v-btn>
        <v-btn
          v-shared-tooltip="() => t('shared.delete')"
          icon
          variant="text"
          density="comfortable"
          size="small"
          color="red"
          @click.stop="remove(item)"
        >
          <v-icon>delete</v-icon>
        </v-btn>
      </template>
    </v-list-item>
  </v-list>
</template>

<script lang="ts" setup>
import { JavaRecord, BaseServiceKey } from '@xmcl/runtime-api'
import { useService } from '@/composables'
import { vSharedTooltip } from '@/directives/sharedTooltip'
import { injection } from '@/util/inject'
import { kInstanceJava } from '@/composables/instanceJava'

defineProps<{
  items: JavaRecord[]
  value: JavaRecord
  remove(java: JavaRecord): void
}>()

const emit = defineEmits(['input'])
const { t } = useI18n()
const { showItemInDirectory } = useService(BaseServiceKey)
const { java, status: javaStatus } = injection(kInstanceJava)

// Mirror the BaseSettingJava hero: when auto-resolution finds no compatible
// Java, tell the user instead of leaving the subtitle blank.
const autoIssue = computed<'none' | 'no-java' | 'no-match'>(() => {
  const stat = javaStatus.value
  if (!stat) return 'none'
  if (stat.noJava) return 'no-java'
  if (!stat.java) return 'no-match'
  return 'none'
})
</script>
