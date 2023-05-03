<template>
  <div class="h-full overflow-auto relative flex flex-col">
    <div class="flex flex-grow-0 pl-4 items-center">
      <v-subheader class="pl-0 py-2">
        <v-icon left>
          shopping_cart
        </v-icon>
        {{ t('modInstall.pending') }}
        <v-divider
          vertical
          class="mx-2"
        />
        <span class="">
          {{ t('items.count', { count: itemCount }) }}
        </span>
      </v-subheader>
      <div class="flex-grow" />
      <v-btn
        text
        color="primary"
        :disabled="list.length === 0"
        :loading="installing"
        @click="commit"
      >
        <v-icon left>
          save
        </v-icon>
        {{ t('modInstall.install') }}
      </v-btn>
    </div>
    <v-list
      class="flex-grow overflow-auto"
      dense
      color="transparent"
    >
      <Hint
        v-if="list.length === 0"
        text="Select project and install file"
        icon="add_shopping_cart"
      />
      <template v-else>
        <template v-for="item of list">
          <ModAddMenuItem
            :key="item.id"
            :item="item"
            :disabled="installing"
            @remove="remove(item.id)"
          />
          <ModAddMenuItem
            v-for="child of item.dependencies"
            :key="child.id"
            :disabled="installing"
            :item="child"
            child
            :type="child.type"
          />
        </template>
      </template>
    </v-list>
  </div>
</template>
<script setup lang="ts">
import Hint from '@/components/Hint.vue'
import ModAddMenuItem from '@/components/ModAddMenuItem.vue'
import { kInstallList } from '@/composables/installList.js'
import { injection } from '@/util/inject'

const { list, remove, commit, installing } = injection(kInstallList)
const itemCount = computed(() => {
  let count = list.value.length
  for (const item of list.value) {
    count += item.dependencies.length
  }
  return count
})
const { t } = useI18n()
</script>
