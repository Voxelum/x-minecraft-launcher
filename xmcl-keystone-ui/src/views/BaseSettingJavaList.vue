<template>
  <v-list
    two-line
    class="overflow-y-auto bg-transparent!"
  >
    <v-list-item
      key="DEFAULT"
      :class="{ primary: value.path === '' }"
      @click="emit('input', { path: '', version: '', majorVersion: 0, valid: false })"
    >
      <v-list-item-avatar>
        <v-icon>close</v-icon>
      </v-list-item-avatar>
      <v-list-item-content>
        <v-list-item-title>
          {{ t("java.allocatedLong") }}
        </v-list-item-title>
        <v-list-item-subtitle>{{ java?.path }}</v-list-item-subtitle>
      </v-list-item-content>
    </v-list-item>
    <v-list-item
      v-for="item in items"
      :key="item.path"
      :class="{ primary: item.path === value.path && item.valid, error: item.path === value.path && !item.valid }"
      @click="emit('input', item)"
    >
      <v-list-item-avatar>
        <span
          class="font-extrabold"
          :style="{
            color: item.path === value.path && item.valid ? 'white' : item.valid ? 'orange' : 'grey'
          }"
        >
          {{ item.majorVersion }}
        </span>
      </v-list-item-avatar>
      <v-list-item-content>
        <v-list-item-title
          v-if="item.valid"
          class="flex items-center gap-2"
        >
          Java {{ item.version }}
          <v-chip
            v-if="item.arch"
            class="h-[20px]"
            color="orange"
            small
            label
            outlined
          >
            {{ item.arch }}
          </v-chip>
        </v-list-item-title>
        <v-list-item-title v-else>
          {{ t('java.invalid') }}
        </v-list-item-title>
        <v-list-item-subtitle>{{ item.path }}</v-list-item-subtitle>
      </v-list-item-content>
      <v-list-item-action>
        <v-btn
          v-if="item.valid"
          icon
          @click.stop="showItemInDirectory(item.path)"
        >
          <v-icon>folder</v-icon>
        </v-btn>
      </v-list-item-action>
      <v-list-item-action>
        <v-btn
          icon
          color="red"
          @click.stop="remove(item)"
        >
          <v-icon>delete</v-icon>
        </v-btn>
      </v-list-item-action>
    </v-list-item>
  </v-list>
</template>

<script lang=ts setup>
import { JavaRecord, BaseServiceKey } from '@xmcl/runtime-api'
import { useService } from '@/composables'
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
const { java } = injection(kInstanceJava)
</script>
