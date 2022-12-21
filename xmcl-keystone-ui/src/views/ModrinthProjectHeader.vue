<template>
  <div class="flex flex-row lg:flex-col gap-2">
    <v-img
      height="150"
      width="150"
      :src="project.icon_url"
      class="rounded-lg"
    />
    <div class="flex flex-col gap-2 items-start">
      <a
        class="text-2xl font-bold"
        :href="`https://modrinth.com/${project.project_type}/${project.slug}`"
      >
        {{ project.title }}
      </a>
      <span class="">{{ project.description }}</span>

      <span class="flex gap-2">
        <v-chip
          v-for="item of categoryItems"
          :key="item.name"
          label
          outlined
          class="mr-2"
        >
          <v-avatar
            v-if="item.icon"
            left
            v-html="item.icon"
          />
          {{ t(`modrinth.categories.${item.name}`) }}
        </v-chip>
      </span>
    </div>
  </div>
</template>
<script lang="ts" setup>
import { useRefreshable, useService } from '@/composables'
import { Category, Project } from '@xmcl/modrinth'
import { ModrinthServiceKey } from '@xmcl/runtime-api'

const props = defineProps<{
  project: Project
}>()
const { t } = useI18n()
const { getTags } = useService(ModrinthServiceKey)
const categories = ref([] as Category[])

const categoryItems = computed(() => {
  return props.project.categories.map(id => categories.value.find(c => c.name === id)).filter((v): v is Category => !!v)
})

const { refresh } = useRefreshable(async () => {
  const result = await getTags()
  categories.value = result.categories
})

onMounted(refresh)

</script>
