<template>
  <div>
    <ModrinthProject
      :id="upstream.projectId.toString()"
    />
  </div>
</template>
<script lang="ts" setup>
import { useCurseforgeInstanceUpdate } from '@/composables/instanceUpdate'
import { Instance, InstanceData } from '@xmcl/runtime-api'
import ModrinthProject from './ModrinthProject.vue'

const props = defineProps<{
  instance: Instance
  upstream: Required<InstanceData>['upstream'] & { type: 'modrinth-modpack' }
}>()

// const { loading, onUpdate, goToPage, status, currentFileResource, latestFile, error, onReinstall } = useCurseforgeInstanceUpdate(props)

const { t } = useI18n()
</script>
