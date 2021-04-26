<template>
  <v-form
    lazy-validation
    style="height: 100%;"
    :value="valid"
    @input="$emit('update:valid', $event)"
  >
    <v-container
      grid-list
      fill-height
      style="overflow: auto;"
    >
      <v-layout
        row
        wrap
      >
        <v-flex
          d-flex
          xs6
        >
          <v-select
            v-model="java"
            class="java-select"
            :item-text="getJavaText"
            :item-value="getJavaVersion"
            :label="$t('java.location')"
            :items="javas"
            :menu-props="{ auto: true, overflowY: true }"
            prepend-inner-icon="add"
            hide-details
            required
          />
        </v-flex>
        <v-flex
          d-flex
          xs3
        >
          <v-text-field
            v-model="minMemory"
            hide-details
            type="number"
            :label="$t('java.minMemory')"
            :placeholder="$t('java.autoAlloc')"
            required
          />
        </v-flex>
        <v-flex
          d-flex
          xs3
        >
          <v-text-field
            v-model="maxMemory"
            hide-details
            type="number"
            :label="$t('java.maxMemory')"
            :placeholder="$t('java.autoAlloc')"
            required
          />
        </v-flex>
        <v-flex
          d-flex
          xs6
        >
          <forge-version-menu
            :minecraft="runtime.minecraft"
            @input="runtime.forge = $event.version"
          >
            <template #default="{ on }">
              <v-text-field
                :value="runtime.forge"
                dark
                append-icon="arrow"
                persistent-hint
                :hint="$t('profile.versionHint')"
                :label="$t('forge.version')"
                :readonly="true"
                @click:append="on.keydown"
                v-on="on"
              />
            </template>
          </forge-version-menu>
        </v-flex>
      </v-layout>
    </v-container>
  </v-form>
</template>

<script lang=ts>
import { defineComponent, inject } from '@vue/composition-api'
import { CreateOptionKey } from './creation'
import { useJava } from '/@/hooks'
import { required } from '/@/util/props'
import { JavaRecord } from '/@shared/entities/java'

export default defineComponent({
  props: {
    valid: required(Boolean),
  },
  emits: ['update:valid'],
  setup() {
    const memoryRule = [(v: any) => Number.isInteger(v)]
    const getJavaVersion = (java: JavaRecord) => `Java ${java.majorVersion}(${java.version})`
    const getItem = (v: JavaRecord) => v.version
    const content = inject(CreateOptionKey)
    const { all: javas } = useJava()
    if (!content) {
      throw new Error('Cannot use without providing CreateOption!')
    }
    return {
      getJavaText: getJavaVersion,
      getJavaVersion: getItem,
      javas,
      maxMemory: content.maxMemory,
      minMemory: content.minMemory,
      java: content.java,
      runtime: content.runtime,
    }
  },
})
</script>

<style>
.java-select .v-select__selection {
  white-space: nowrap;
  overflow-x: hidden;
  overflow-y: hidden;

  max-width: 240px;
}
</style>
