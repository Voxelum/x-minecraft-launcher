<template>
  <div>
    <HomeUpstreamCardCurseforge
      :instance="instance"
      :upstream="upstream"
    />
    <CurseforgeProject
      :id="upstream.modId.toString()"
      :type="'modpacks'"
      :from="instance.path"
    />
  </div>
</template>
<script lang="ts" setup>
import { Instance, InstanceData } from '@xmcl/runtime-api'
import CurseforgeProject from './CurseforgeProject.vue'
import HomeUpstreamCardCurseforge from './HomeUpstreamCardCurseforge.vue';

const props = defineProps<{
  instance: Instance
  upstream: Required<InstanceData>['upstream'] & { type: 'curseforge-modpack' }
}>()

// const { loading, onUpdate, goToPage, status, currentFileResource, latestFile, error, onReinstall } = useCurseforgeInstanceUpdate(props)

const { t } = useI18n()
</script>
