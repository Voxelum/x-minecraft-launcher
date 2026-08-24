<script lang="ts" setup>
import { kInstance } from '@/composables/instance'
import { useInstanceContextMenuItems } from '@/composables/instanceContextMenu'
import { kInstanceLaunchCoordinator } from '@/composables/instanceLaunchCoordinator'
import { kInstances } from '@/composables/instances'
import { kLaunchButton } from '@/composables/launchButton'
import { useInjectSidebarSettings } from '@/composables/sidebarSettings'
import { getInstanceIcon } from '@/util/favicon'
import { injection } from '@/util/inject'
import { useInstanceServerStatus } from '../composables/serverStatus'
import { BuiltinImages } from '../constant'
import AppSideBarNotchItem from './AppSideBarNotchItem.vue'

const props = defineProps<{
  path: string
  inside?: boolean
  direction?: 'top' | 'bottom' | 'left' | 'right'
}>()

const { instances, selectedInstance } = injection(kInstances)
const { isLaunching, isRunning, launch } = injection(kInstanceLaunchCoordinator)
const { onClick: onLaunchClick } = injection(kLaunchButton)
const { pinnedInstances } = useInjectSidebarSettings()

const instance = computed(() => instances.value.find((i) => i.path === props.path))
const isPinned = computed(() => pinnedInstances.value.includes(props.path))
const name = computed(() => {
  if (!instance.value) return ''
  if (instance.value.name) return instance.value.name
  if (instance.value.runtime.minecraft) return `Minecraft ${instance.value.runtime.minecraft}`
  return ''
})
const runtimes = computed(() => {
  const inst = instance.value
  if (!inst) return []
  const iconAndVersion = [] as { icon: string; text: string }[]
  if (inst.runtime.minecraft) iconAndVersion.push({ icon: BuiltinImages.minecraft, text: inst.runtime.minecraft })
  if (inst.runtime.forge) iconAndVersion.push({ icon: BuiltinImages.forge, text: inst.runtime.forge })
  if (inst.runtime.labyMod) iconAndVersion.push({ icon: BuiltinImages.labyMod, text: inst.runtime.labyMod })
  if (inst.runtime.neoForged) iconAndVersion.push({ icon: BuiltinImages.neoForged, text: inst.runtime.neoForged })
  if (inst.runtime.fabricLoader) iconAndVersion.push({ icon: BuiltinImages.fabric, text: inst.runtime.fabricLoader })
  if (inst.runtime.quiltLoader) iconAndVersion.push({ icon: BuiltinImages.quilt, text: inst.runtime.quiltLoader })
  if (inst.runtime.optifine) iconAndVersion.push({ icon: BuiltinImages.optifine, text: inst.runtime.optifine })
  return iconAndVersion
})

const router = useRouter()

const { select } = injection(kInstance)

const { status } = useInstanceServerStatus(instance)
const favicon = computed(() => {
  const inst = instance.value
  if (!inst) return ''
  return getInstanceIcon(inst, inst.server ? status.value : undefined)
})

const getContextMenu = useInstanceContextMenuItems(instance)

const route = useRoute()
const isActive = computed(() => props.path === selectedInstance.value && route.path === '/')

const navigate = () => {
  if (router.currentRoute.value.path !== '/') {
    router.push('/').then(() => {
      select(props.path)
    })
  } else {
    select(props.path)
  }
}

const launchInstance = () => {
  void launch(props.path, async () => {
    select(props.path)
    await nextTick()
    await onLaunchClick()
  }).catch(console.error)
}

</script>
<template>
  <div class="notch-instance-wrapper">
    <AppSideBarNotchItem
      :image="favicon"
      :tooltip="() => ({ text: name, items: runtimes, direction: props.direction })"
      :active="isActive"
      :context-menu="getContextMenu"
      @click="navigate"
      @dblclick="launchInstance"
    />
    <div v-if="isLaunching(path)" class="instance-status instance-status--launching">
      <v-progress-circular indeterminate :size="18" :width="2" color="white" />
    </div>
    <div v-else-if="isRunning(path)" class="instance-status instance-status--running">
      <v-icon :size="11" color="white">play_arrow</v-icon>
    </div>
    <!-- Pin indicator -->
    <div
      v-if="isPinned"
      class="pin-badge"
    >
      <v-icon size="x-small" color="white" class="text-[8px]">push_pin</v-icon>
    </div>
  </div>
</template>

<style scoped>
.notch-instance-wrapper {
  position: relative;
}

.instance-status {
  position: absolute;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

.instance-status--launching {
  inset: 6px;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.55);
}

.instance-status--running {
  right: 0;
  bottom: 0;
  width: 16px;
  height: 16px;
  border: 2px solid rgb(var(--v-theme-surface));
  border-radius: 50%;
  background: rgb(var(--v-theme-success));
}

.pin-badge {
  position: absolute;
  top: -2px;
  right: -2px;
  width: 14px;
  height: 14px;
  background-color: #EAB308;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  pointer-events: none;
}
</style>
