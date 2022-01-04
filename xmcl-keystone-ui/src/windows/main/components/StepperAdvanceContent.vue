<template>
  <v-list
    three-line
    subheader
    style="background: transparent; width: 100%"
  >
    <v-list-tile>
      <v-form
        lazy-validation
        class="w-full"
        :value="valid"
        @input="$emit('update:valid', $event)"
      >
        <v-layout
          row
          wrap
          class="gap-4"
        >
          <v-flex d-flex>
            <v-select
              v-model="java"
              class="java-select"
              :label="$t('java.location')"
              :item-text="getJavaText"
              :item-value="getJavaVersion"
              :items="javas"
              :menu-props="{ auto: true, overflowY: true }"
              hide-details
              required
            />
          </v-flex>
          <v-flex
            d-flex
            xs2
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
            xs2
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
        </v-layout>
      </v-form>
    </v-list-tile>
    <v-list-tile v-if="showMinecraft">
      <v-list-tile-action>
        <img
          :src="minecraftPng"
          width="40"
        >
        <!-- <v-checkbox /> -->
      </v-list-tile-action>
      <v-list-tile-content>
        <v-list-tile-title>
          {{
            $t('minecraft.version')
          }}
        </v-list-tile-title>
        <v-list-tile-sub-title>
          {{
            $t('profile.versionHint')
          }}
        </v-list-tile-sub-title>
      </v-list-tile-content>
      <v-list-tile-action>
        <minecraft-version-menu @input="onSelectMinecraft">
          <template #default="{ on }">
            <v-text-field
              v-model="runtime.minecraft"
              dark
              append-icon="arrow_drop_down"
              persistent-hint
              :readonly="true"
              @click:append="on.keydown"
              v-on="on"
            />
          </template>
        </minecraft-version-menu>
      </v-list-tile-action>
    </v-list-tile>
    <v-list-tile>
      <v-list-tile-action>
        <img
          :src="forgePng"
          width="40"
        >
        <!-- <v-checkbox /> -->
      </v-list-tile-action>
      <v-list-tile-content>
        <v-list-tile-title>
          {{
            $t('forge.version')
          }}
        </v-list-tile-title>
        <v-list-tile-sub-title>
          {{
            $t('profile.versionHint')
          }}
        </v-list-tile-sub-title>
      </v-list-tile-content>
      <v-list-tile-action>
        <forge-version-menu
          :minecraft="runtime.minecraft"
          @input="onSelectForge"
        >
          <template #default="{ on }">
            <v-text-field
              :value="runtime.forge"
              dark
              append-icon="arrow_drop_down"
              persistent-hint
              :readonly="true"
              @click:append="on.keydown"
              v-on="on"
            />
          </template>
        </forge-version-menu>
      </v-list-tile-action>
    </v-list-tile>
    <v-list-tile>
      <v-list-tile-action>
        <img
          :src="fabricPng"
          width="40"
        >
        <!-- <forge-icon></forge-icon> -->
        <!-- <v-checkbox /> -->
      </v-list-tile-action>
      <v-list-tile-content>
        <v-list-tile-title>Fabric</v-list-tile-title>
        <v-list-tile-sub-title>
          {{
            $t('profile.versionHint')
          }}
        </v-list-tile-sub-title>
      </v-list-tile-content>
      <v-list-tile-action>
        <fabric-version-menu
          :minecraft="runtime.minecraft"
          @input="onSelectFabric"
        >
          <template #default="{ on }">
            <v-text-field
              :value="runtime.fabricLoader"
              dark
              append-icon="arrow_drop_down"
              persistent-hint
              :readonly="true"
              @click:append="on.keydown"
              v-on="on"
            />
          </template>
        </fabric-version-menu>
      </v-list-tile-action>
    </v-list-tile>
  </v-list>
</template>

<script lang=ts>
import { defineComponent, inject } from '@vue/composition-api'
import FabricVersionMenu from './FabricVersionMenu.vue'
import ForgeVersionMenu from './ForgeVersionMenu.vue'
import MinecraftVersionMenu from './MinecraftVersionMenu.vue'
import { CreateOptionKey } from './AddInstanceDialog.vue'
import { useJava } from '/@/hooks'
import { required, withDefault } from '/@/util/props'
import { JavaRecord } from '@xmcl/runtime-api'
import forgePng from '/@/assets/forge.png'
import minecraftPng from '/@/assets/minecraft.png'
import fabricPng from '/@/assets/fabric.png'

export default defineComponent({
  components: { ForgeVersionMenu, MinecraftVersionMenu, FabricVersionMenu },
  props: {
    valid: required(Boolean),
    showMinecraft: withDefault(Boolean, () => true),
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
    function onSelectForge(event: { version: string }) {
      if (content?.runtime.value) {
        const runtime = content.runtime.value
        runtime.forge = event.version
        if (event.version) {
          runtime.fabricLoader = ''
        }
      }
    }
    function onSelectFabric(event: { version: string }) {
      if (content?.runtime.value) {
        const runtime = content.runtime.value
        if (event.version) {
          runtime.forge = ''
        }
        runtime.fabricLoader = event.version
      }
    }
    function onSelectMinecraft(version: string) {
      if (content?.runtime.value) {
        const runtime = content.runtime.value
        runtime.minecraft = version
        runtime.forge = ''
        runtime.fabricLoader = ''
      }
    }
    return {
      getJavaText: getJavaVersion,
      getJavaVersion: getItem,
      javas,
      maxMemory: content.maxMemory,
      minMemory: content.minMemory,
      java: content.java,
      runtime: content.runtime,
      onSelectMinecraft,
      onSelectFabric,
      onSelectForge,
      forgePng,
      minecraftPng,
      fabricPng,
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
