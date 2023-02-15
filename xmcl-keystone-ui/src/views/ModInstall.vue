<template>
  <div>
    <v-list>
      <template v-for="item of list">
        <v-list-item
          v-if="item.dependencies.length === 0"
          :key="item.id"
        >
          <v-list-item-action>
            <v-checkbox v-model="item.disabled" />
          </v-list-item-action>
          <v-list-item-title>{{ item.name }}</v-list-item-title>
        </v-list-item>
        <v-list-group
          v-else
          :key="item.id"
        >
          <template #activator>
            <v-list-item-action>
              <v-checkbox v-model="item.disabled" />
            </v-list-item-action>
            <v-list-item-title>{{ item.name }}</v-list-item-title>
          </template>
          <v-list-item
            v-for="child of item.dependencies"
            :key="child.id"
          >
            <v-list-item-action>
              <v-checkbox v-model="child.disabled" />
            </v-list-item-action>
            <v-list-item-content>
              <v-list-item-title>{{ child.name }}</v-list-item-title>
              <v-list-subtitle> {{ child.type }} </v-list-subtitle>
            </v-list-item-content>
            <v-list-item-action>
              <v-btn
                color="error"
                icon
                text
              >
                <v-icon>delete</v-icon>
              </v-btn>
            </v-list-item-action>
          </v-list-item>
        </v-list-group>
      </template>
    </v-list>
  </div>
</template>
<script lang="ts" setup>
import { kModInstallList } from '@/composables/modInstallList'
import { injection } from '@/util/inject'

defineProps()

const { list } = injection(kModInstallList)
</script>
