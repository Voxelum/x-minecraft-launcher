<template>
  <div class="h-full overflow-auto relative flex flex-col">
    <div class="flex flex-grow-0 pl-4 items-center">
      <v-subheader class="pl-0 py-2">
        <v-icon left>
          shopping_cart
        </v-icon>
        Pending to Install
        <v-divider
          vertical
          class="mx-2"
        />
        <span class="">
          {{ list.length }} items
        </span>
      </v-subheader>
      <div class="flex-grow" />
      <v-btn
        text
        :disabled="list.length === 0"
        @click="commit"
      >
        <v-icon left>
          save
        </v-icon>
        <!-- {{ t('modSearch.install') }} -->
        Install
      </v-btn>
    </div>
    <v-list
      class="flex-grow overflow-auto"
      dense
      color="transparent"
    >
      <v-list-item v-if="list.length === 0">
        <v-list-item-content>
          <v-list-item-title> No install yet </v-list-item-title>
        </v-list-item-content>
      </v-list-item>
      <template v-else>
        <template v-for="item of list">
          <ModAddMenuItem
            :key="item.id"
            :item="item"
            @remove="remove(item.id)"
          />
          <ModAddMenuItem
            v-for="child of item.dependencies"
            :key="child.id"
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
import ModAddMenuItem from '@/components/ModAddMenuItem.vue'
import { kModInstallList } from '@/composables/modInstallList'
import { injection } from '@/util/inject'

const { list, remove, commit } = injection(kModInstallList)
const { t } = useI18n()
</script>
