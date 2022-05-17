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
            v-model="content.java"
            outlined
            class="java-select"
            :label="$t('java.location')"
            :placeholder="$t('java.allocatedLong')"
            :items="javaItems"
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
            v-model="content.minMemory"
            outlined
            hide-details
            type="number"
            :label="$t('java.minMemory')"
            :placeholder="$t('java.allocatedShort')"
            required
          />
        </v-flex>
        <v-flex
          d-flex
          xs2
        >
          <v-text-field
            v-model="content.maxMemory"
            outlined
            hide-details
            type="number"
            :label="$t('java.maxMemory')"
            :placeholder="$t('java.allocatedShort')"
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
            $t('minecraftVersion.name')
          }}
        </v-list-item-title>
        <v-list-item-subtitle>
          {{
            $t('instance.versionHint')
          }}
        </v-list-item-subtitle>
      </v-list-item-content>
      <v-list-item-action>
        <minecraft-version-menu @input="onSelectMinecraft">
          <template #default="{ on }">
            <v-text-field
              v-model="content.runtime.minecraft"
              outlined
              append-icon="arrow_drop_down"
              persistent-hint
              hide-details
              :readonly="true"
              @click:append="on.click"
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
            $t('forgeVersion.name')
          }}
        </v-list-item-title>
        <v-list-item-subtitle>
          {{
            $t('instance.versionHint')
          }}
        </v-list-item-subtitle>
      </v-list-item-content>
      <v-list-item-action>
        <forge-version-menu
          :minecraft="content.runtime.minecraft"
          @input="onSelectForge"
        >
          <template #default="{ on }">
            <v-text-field
              :value="content.runtime.forge"
              outlined
              append-icon="arrow_drop_down"
              hide-details
              persistent-hint
              :readonly="true"
              @click:append="on.click"
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
            $t('instance.versionHint')
          }}
        </v-list-item-subtitle>
      </v-list-item-content>
      <v-list-item-action>
        <fabric-version-menu
          :minecraft="content.runtime.minecraft"
          @input="onSelectFabric"
        >
          <template #default="{ on }">
            <v-text-field
              :value="content.runtime.fabricLoader"
              outlined
              hide-details
              append-icon="arrow_drop_down"
              persistent-hint
              :readonly="true"
              @click:append="on.click"
              v-on="on"
            />
          </template>
        </fabric-version-menu>
      </v-list-item-action>
    </v-list-item>
  </v-list>
</template>

<script lang=ts setup>
import forgePng from '/@/assets/forge.png'
import minecraftPng from '/@/assets/minecraft.png'
import fabricPng from '/@/assets/fabric.png'
import FabricVersionMenu from './FabricVersionMenu.vue'
import ForgeVersionMenu from './ForgeVersionMenu.vue'
import MinecraftVersionMenu from './MinecraftVersionMenu.vue'
import { CreateOptionKey } from '../composables/instanceCreation'
import { useJava } from '../composables/java'
import { injection } from '/@/util/inject'

const props = defineProps({
  valid: {
    type: Boolean,
    required: true,
  },
  showMinecraft: {
    type: Boolean,
    default: true,
  },
})

const emit = defineEmits(['update:valid'])
const memoryRule = [(v: any) => Number.isInteger(v)]
const content = injection(CreateOptionKey)
const { all: javas } = useJava()
const javaItems = computed(() => javas.value.map(java => ({
  text: `Java ${java.majorVersion} (${java.version})`,
  value: java.path,
})))
function onSelectForge(event: { version: string }) {
  if (content?.runtime) {
    const runtime = content.runtime
    runtime.forge = event.version
    if (event.version) {
      runtime.fabricLoader = ''
    }
  }
}
function onSelectFabric(event: { version: string }) {
  if (content?.runtime) {
    const runtime = content.runtime
    if (event.version) {
      runtime.forge = ''
    }
    runtime.fabricLoader = event.version
  }
}
function onSelectMinecraft(version: string) {
  if (content?.runtime) {
    const runtime = content.runtime
    runtime.minecraft = version
    runtime.forge = ''
    runtime.fabricLoader = ''
  }
}
</script>

<style>
.java-select .v-select__selection {
  white-space: nowrap;
  overflow-x: hidden;
  overflow-y: hidden;

  max-width: 240px;
}
</style>
