<template>
  <v-list
    three-line
    subheader
    style="background: transparent; width: 100%"
  >
    <v-list-item>
      <v-layout
        row
        class="gap-4 max-w-full"
      >
        <v-flex d-flex>
          <v-select
            v-model="java"
            outlined
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
            outlined
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
            outlined
            hide-details
            type="number"
            :label="$t('java.maxMemory')"
            :placeholder="$t('java.autoAlloc')"
            required
          />
        </v-flex>
      </v-layout>
    </v-list-item>
    <v-list-item v-if="showMinecraft">
      <v-list-item-action class="self-center">
        <img
          :src="minecraftPng"
          width="40"
        >
        <!-- <v-checkbox /> -->
      </v-list-item-action>
      <v-list-item-content>
        <v-list-item-title>
          {{
            $t('minecraft.version')
          }}
        </v-list-item-title>
        <v-list-item-subtitle>
          {{
            $t('profile.versionHint')
          }}
        </v-list-item-subtitle>
      </v-list-item-content>
      <v-list-item-action>
        <minecraft-version-menu @input="onSelectMinecraft">
          <template #default="{ on }">
            <v-text-field
              v-model="runtime.minecraft"
              outlined
              append-icon="arrow_drop_down"
              persistent-hint
              hide-details
              :readonly="true"
              @click:append="on.keydown"
              v-on="on"
            />
          </template>
        </minecraft-version-menu>
      </v-list-item-action>
    </v-list-item>
    <v-list-item>
      <v-list-item-action class="self-center">
        <img
          :src="forgePng"
          width="40"
        >
      </v-list-item-action>
      <v-list-item-content>
        <v-list-item-title>
          {{
            $t('forge.version')
          }}
        </v-list-item-title>
        <v-list-item-subtitle>
          {{
            $t('profile.versionHint')
          }}
        </v-list-item-subtitle>
      </v-list-item-content>
      <v-list-item-action>
        <forge-version-menu
          :minecraft="runtime.minecraft"
          @input="onSelectForge"
        >
          <template #default="{ on }">
            <v-text-field
              :value="runtime.forge"
              outlined
              append-icon="arrow_drop_down"
              hide-details
              persistent-hint
              :readonly="true"
              @click:append="on.keydown"
              v-on="on"
            />
          </template>
        </forge-version-menu>
      </v-list-item-action>
    </v-list-item>
    <v-list-item>
      <v-list-item-action class="self-center">
        <img
          :src="fabricPng"
          width="40"
        >
        <!-- <forge-icon></forge-icon> -->
        <!-- <v-checkbox /> -->
      </v-list-item-action>
      <v-list-item-content>
        <v-list-item-title>Fabric</v-list-item-title>
        <v-list-item-subtitle>
          {{
            $t('profile.versionHint')
          }}
        </v-list-item-subtitle>
      </v-list-item-content>
      <v-list-item-action>
        <fabric-version-menu
          :minecraft="runtime.minecraft"
          @input="onSelectFabric"
        >
          <template #default="{ on }">
            <v-text-field
              :value="runtime.fabricLoader"
              outlined
              hide-details
              append-icon="arrow_drop_down"
              persistent-hint
              :readonly="true"
              @click:append="on.keydown"
              v-on="on"
            />
          </template>
        </fabric-version-menu>
      </v-list-item-action>
    </v-list-item>
  </v-list>
</template>

<script lang=ts>
import { required, withDefault } from '/@/util/props'
import { JavaRecord } from '@xmcl/runtime-api'
import forgePng from '/@/assets/forge.png'
import minecraftPng from '/@/assets/minecraft.png'
import fabricPng from '/@/assets/fabric.png'
import FabricVersionMenu from './FabricVersionMenu.vue'
import ForgeVersionMenu from './ForgeVersionMenu.vue'
import MinecraftVersionMenu from './MinecraftVersionMenu.vue'
import { CreateOptionKey } from '../composables/instanceCreation'
import { useJava } from '../composables/java'
import { injection } from '/@/util/inject'

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
    const content = injection(CreateOptionKey)
    const { all: javas } = useJava()
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
