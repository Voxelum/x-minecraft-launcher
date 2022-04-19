<template>
  <v-menu
    offset-y
    top

    max-height="300"
  >
    <template #activator="{ on }">
      <v-btn
        v-show="refreshing || items.length !== 0"
        slot="activator"
        :loading="refreshing"
        :text="items.length !== 0"
        outlined
        :color="color"
        v-on="on"
      >
        <v-icon
          left

          :color="color"
        >
          {{ items.length !== 0 ?
            'warning' : 'check_circle' }}
        </v-icon>
        {{ tc('diagnosis.problem', items.length, { count: items.length }) }}
      </v-btn>
    </template>

    <v-list>
      <template v-for="(item, index) in items">
        <v-list-item
          :key="index"
          ripple
          @click="fix(item, issues)"
        >
          <v-list-item-content>
            <v-list-item-title>
              {{ item.title }}
            </v-list-item-title>
            <v-list-item-subtitle>
              {{ item.description }}
            </v-list-item-subtitle>
          </v-list-item-content>
          <v-list-item-action>
            <v-icon> {{ item.autoFix ? 'build' : 'arrow_right' }} </v-icon>
          </v-list-item-action>
        </v-list-item>
      </template>
    </v-list>
  </v-menu>
</template>

<script lang=ts setup>
import { AssetIndexIssueKey, AssetsIssueKey, isIssue, LibrariesIssueKey, VersionIssueKey, VersionJarIssueKey, VersionJsonIssueKey } from '@xmcl/runtime-api'
import { useI18n, useIssues } from '/@/composables'

const { issues, refreshing, fix } = useIssues()
const color = computed(() => (issues.value.some(p => !p.optional) ? 'red' : 'warning'))
const { t, tc } = useI18n()
const items = computed(() => issues.value
  .filter(v => v.parameters.length > 0)
  .map((i) => {
    if (isIssue(AssetsIssueKey, i)) {
      if (i.parameters[0].assets.some(v => v.type === 'corrupted')) {
        return { title: tc('diagnosis.corruptedAssets.name', 3, { count: i.parameters[0].assets.length }), description: t('diagnosis.corruptedAssets.message'), ...i }
      } else {
        return { title: tc('diagnosis.missingAssets.name', 3, { count: i.parameters[0].assets.length }), description: t('diagnosis.missingAssets.message'), ...i }
      }
    } else if (isIssue(LibrariesIssueKey, i)) {
      if (i.parameters[0].libraries.some(v => v.type === 'corrupted')) {
        return { title: tc('diagnosis.corruptedLibraries.name', 3, { count: i.parameters[0].libraries.length }), description: t('diagnosis.corruptedLibraries.message'), ...i }
      } else {
        return { title: tc('diagnosis.missingLibraries.name', 3, { count: i.parameters[0].libraries.length }), description: t('diagnosis.missingLibraries.message'), ...i }
      }
    } else if (isIssue(AssetIndexIssueKey, i)) {
      if (i.parameters[0].type === 'corrupted') {
        return { title: t('diagnosis.corruptedAssetsIndex.name', { version: i.parameters[0].version }), description: t('diagnosis.corruptedAssetsIndex.message'), ...i }
      } else {
        return { title: t('diagnosis.missingAssetsIndex.name', { version: i.parameters[0].version }), description: t('diagnosis.missingAssetsIndex.message'), ...i }
      }
    } else if (isIssue(VersionJarIssueKey, i)) {
      if (i.parameters[0].type === 'corrupted') {
        return { title: t('diagnosis.corruptedVersionJar.name', { version: i.parameters[0].version }), description: t('diagnosis.corruptedVersionJar.message'), ...i }
      } else {
        return { title: t('diagnosis.missingVersionJar.name', { version: i.parameters[0].version }), description: t('diagnosis.missingVersionJar.message'), ...i }
      }
    } else if (isIssue(VersionJsonIssueKey, i)) {
      return { title: t('diagnosis.corruptedVersionJson.name'), description: t('diagnosis.corruptedVersionJson.message'), ...i }
    } else if (isIssue(VersionIssueKey, i)) {
      return { title: t('diagnosis.missingVersion.name', { version: i.parameters[0].version }), description: t('diagnosis.missingVersion.message'), ...i }
    }
    return { title: tc(`diagnosis.${i.id}.name`, i.parameters.length || 0, i.parameters[0]), description: t(`diagnosis.${i.id}.description`, { }), ...i }
  })
  .filter(v => !!v))

</script>

<style>
</style>
