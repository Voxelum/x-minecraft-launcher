<template>
  <div
    v-if="!mod"
    class="flex gap-6 overflow-auto p-4 lg:flex-row flex-col"
  >
    <v-progress-linear
      class="absolute top-0 z-10 m-0 p-0 left-0"
      :active="refreshing"
      height="3"
      :indeterminate="true"
    />
  </div>
  <div
    v-else
    class="flex gap-6 overflow-auto p-4 lg:flex-row flex-col"
  >
    <v-progress-linear
      class="absolute top-0 z-10 m-0 p-0 left-0"
      :active="refreshing"
      height="3"
      :indeterminate="true"
    />
    <div class="flex flex-col gap-4 flex-grow-0">
      <Header
        class="flex-grow-0"
        :title="mod.title"
        :description="mod.description"
        :icon="mod.icon_url"
        :discord-url="mod.discord_url"
        :issue-url="mod.issues_url"
        :wiki_url="mod.wiki_url"
        :source-url="mod.source_url"
      />
      <v-tabs class="rounded-lg">
        <v-tab :key="0">
          {{ $t('modrinth.description') }}
        </v-tab>
        <v-tab :key="1">
          {{ $t('modrinth.versions') }}
        </v-tab>
        <v-tab-item :key="0">
          <Description :description="mod.body" />
        </v-tab-item>
        <v-tab-item :key="1">
          <Versions
            :versions="mod.versions"
            @install="onInstall"
          />
        </v-tab-item>
      </v-tabs>
    </div>
    <div class="flex flex-col gap-4 flex-grow">
      <Tags
        :downloads="mod.downloads"
        :license="mod.license"
        :server-side="mod.server_side"
        :client-side="mod.client_side"
        :mod-id="id"
        :create-at="mod.published"
        :update-at="mod.updated"
      />
      <Members />
      <FeaturedVersions />
    </div>
  </div>
</template>
<script lang="ts">
import { defineComponent, onMounted, reactive, Ref, ref } from '@vue/composition-api'
import Tags from './components/Tags.vue'
import Members from './components/Members.vue'
import FeaturedVersions from './components/FeaturedVersions.vue'
import Header from './components/Header.vue'
import Versions from './components/Versions.vue'
import Description from './components/Description.vue'
import { useService } from '/@/hooks'
import { ModrinthServiceKey } from '@xmcl/runtime-api'
import { useRefreshable } from '/@/hooks/useRefreshable'
import { required } from '/@/util/props'
import { Mod, ModVersion } from '@xmcl/modrinth'

export default defineComponent({
  components: { Tags, Members, FeaturedVersions, Header, Versions, Description },
  props: {
    id: required(String),
  },
  setup(props) {
    const { getMod, installModVersion } = useService(ModrinthServiceKey)
    const mod: Ref<undefined | Mod> = ref(undefined)
    const { refresh, refreshing } = useRefreshable(async () => {
      const result = await getMod(props.id)
      mod.value = result
    })
    const onInstall = (mod: ModVersion) => {
      installModVersion({ version: mod })
    }
    onMounted(() => {
      refresh()
    })
    return {
      onInstall,
      mod,
      refreshing,
    }
  },
})
</script>

<style>
.v-tabs__bar {
  border-top-left-radius: inherit;
  border-top-right-radius: inherit;
  border-bottom-right-radius: unset;
  border-bottom-left-radius: unset;
}
</style>
