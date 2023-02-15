<template>
  <v-menu
    offset-y
    :close-on-content-click="false"
  >
    <template #activator="{ on }">
      <v-badge
        right
        overlap
        :value="list.length > 0"
      >
        <template #badge>
          {{ list.length > 9 ? '9+' : list.length }}
        </template>
        <v-btn
          icon
          v-on="on"
        >
          <v-icon>
            shopping_cart
          </v-icon>
        </v-btn>
      </v-badge>
    </template>
    <v-sheet
      color="black"
      class="overflow-auto max-h-[70vh] min-w-100 max-w-100 flex flex-col gap-3 p-3"
    >
      <div class="flex">
        <v-btn text>
          Pending
        </v-btn>
        <div class="flex-grow" />
      </div>

      <v-list class="rounded-lg overflow-auto h-full">
        <v-list-item v-if="list.length === 0">
          <v-list-item-content>
            <v-list-item-title> No install yet </v-list-item-title>
          </v-list-item-content>
        </v-list-item>
        <template v-else>
          <v-list-item
            v-for="item of list"
            :key="item.id"
          >
            <v-list-item-avatar v-if="item.icon">
              <v-img :src="item.icon" />
            </v-list-item-avatar>
            <v-list-item-content>
              <v-list-item-title :title="item.name">
                {{ item.name }}
              </v-list-item-title>
              <v-list-item-subtitle v-if="item.projectName">
                {{ item.projectName }}
              </v-list-item-subtitle>
            </v-list-item-content>
            <v-list-item-action>
              <v-btn
                icon
                color="error"
                @click="remove(item.id)"
              >
                <v-icon>
                  delete
                </v-icon>
              </v-btn>
            </v-list-item-action>
          </v-list-item>
        </template>
      </v-list>

      <div class="flex">
        <div class="flex-grow" />
        <v-btn
          text
          @click="commit"
        >
          Install
        </v-btn>
      </div>
    </v-sheet>
  </v-menu>
</template>
<script setup lang="ts">
import { kModInstallList } from '@/composables/modInstallList'
import { injection } from '@/util/inject'

const { list, remove, commit } = injection(kModInstallList)

</script>
