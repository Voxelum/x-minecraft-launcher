<template>
  <v-card flat style="min-height: 300px; max-width: 100%;" class="flex flex-col overflow-auto">
    <v-toolbar tabs class="flex-grow-0">
      <v-toolbar-title>{{ t('task.manager') }}</v-toolbar-title>
      <v-spacer />
      <v-btn icon @click="hide">
        <v-icon>close</v-icon>
      </v-btn>
      <template #extension>
        <v-tabs v-model="tab" centered>
          <v-tab>{{ t('task.name', 2) }}</v-tab>
          <v-tab>{{ t('task.connections') }}</v-tab>
        </v-tabs>
      </template>
    </v-toolbar>

    <v-card-text class="visible-scroll max-h-[400px] overflow-auto">
      <v-tabs-items v-model="tab" class="mt-2">
        <v-tab-item :key="0">
          <div v-if="tasks.length === 0">
            {{ t('task.empty') }}
          </div>
          <v-list color="transparent" >
            <AppTaskDialogTaskItem
              v-for="item in tasks"
              :key="item.id"
              :item="item"
              @cancel="cancel(item)"
            />
          </v-list>
        </v-tab-item>
        <v-tab-item :key="1">
          <v-text-field
            v-model="poolFilter"
            :placeholder="t('shared.filter')"
            prepend-inner-icon="filter_list"
            hide-details
            outlined
            filled
            dense
            class="mb-2"
          />
          <v-list dense two-lines>
            <v-list-item v-for="[o, s] of filteredPools" :key="o">
              <v-list-item-content>
                <v-list-item-title>
                  {{ o }}
                </v-list-item-title>
                <v-list-item-subtitle class="flex gap-3">
                  <span>
                    {{ t('task.connection.connected') }}: {{ s.connected }}
                  </span>
                  <span>
                    {{ t('task.connection.free') }}: {{ s.free }}
                  </span>
                  <span>
                    {{ t('task.connection.pending') }}: {{ s.pending }}
                  </span>
                  <span>
                    {{ t('task.connection.queued') }}: {{ s.queued }}
                  </span>
                  <span>
                    {{ t('task.connection.running') }}: {{ s.running }}
                  </span>
                  <span>
                    {{ t('task.connection.size') }}: {{ s.size }}
                  </span>
                </v-list-item-subtitle>
              </v-list-item-content>
              <v-list-item-action>
                <v-btn icon small @click="destroyPool(o)">
                  <v-icon>
                    close
                  </v-icon>
                </v-btn>
              </v-list-item-action>
            </v-list-item>
          </v-list>
        </v-tab-item>
      </v-tabs-items>
    </v-card-text>
    <div class="flex-grow" />
    <v-card-actions class="flex flex-grow-0">
      <div class="flex-grow" />
      <v-btn text small @click="onClear">
        <v-icon left>
          delete_forever
        </v-icon>
        {{ t('task.clear') }}
      </v-btn>
    </v-card-actions>
  </v-card>
</template>

<script lang=ts setup>
import { useService } from '@/composables'
import { useDialog } from '@/composables/dialog'
import { kTaskManager } from '@/composables/taskManager'
import { injection } from '@/util/inject'
import { BaseServiceKey } from '@xmcl/runtime-api'
import AppTaskDialogTaskItem from './AppTaskDialogTaskItem.vue'
import { kNetworkStatus } from '@/composables/useNetworkStatus'

const tab = ref(0)

const { tasks, cancel, clear } = injection(kTaskManager)
const { status } = injection(kNetworkStatus)
const { t } = useI18n()

const poolFilter = ref('')
const filteredPools = computed(() => {
  const pools = Object.entries(status.value?.pools ?? {})
  const filtered = poolFilter.value
    ? pools.filter(([name]) => name.toLowerCase().includes(poolFilter.value.toLowerCase()))
    : pools
  return filtered.sort(([a], [b]) => a.localeCompare(b))
})

const { destroyPool } = useService(BaseServiceKey)

const { hide } = useDialog('task')

function onClear() {
  clear()
}
</script>
