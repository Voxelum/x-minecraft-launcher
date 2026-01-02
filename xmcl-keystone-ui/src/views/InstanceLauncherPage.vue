<template>
  <transition name="launcher-fade">
    <div
      v-if="isOpen"
      class="instance-launcher-overlay"
      @click.self="close"
      @keydown.esc="close"
      tabindex="0"
    >
      <div class="instance-launcher-container" :class="{ 'instance-launcher-container--embedded': embedded }">
        <!-- Header -->
        <div class="launcher-header">
          <h1 class="launcher-title">{{ t('instanceLauncher.title') }}</h1>
          <v-btn v-if="!embedded" icon @click="close" class="close-btn">
            <v-icon>close</v-icon>
          </v-btn>
        </div>

        <!-- Search Bar -->
        <div class="launcher-search">
          <v-text-field
            v-model="searchQuery"
            :placeholder="t('instanceLauncher.search')"
            prepend-inner-icon="search"
            outlined
            dense
            hide-details
            class="search-input"
          />
        </div>

        <!-- Instance Grid -->
        <div class="launcher-grid">
          <!-- Create New Instance Card -->
          <div
            class="instance-card instance-card--create"
            @click="handleCreateInstance"
          >
            <div class="instance-card__icon">
              <v-icon size="64" color="primary">add_circle</v-icon>
            </div>
            <div class="instance-card__name">{{ t('instanceLauncher.createNew') }}</div>
          </div>

          <!-- Instance Cards -->
          <div
            v-for="instance in filteredInstances"
            :key="instance.path"
            class="instance-card"
            :class="{ 'instance-card--active': instance.path === selectedInstance }"
            @click="handleSelectInstance(instance.path)"
          >
            <div class="instance-card__icon">
              <v-img
                :src="getInstanceIcon(instance, undefined)"
                :width="64"
                :height="64"
                class="instance-icon"
              />
            </div>
            <div class="instance-card__name">{{ instance.name || 'Unknown' }}</div>
            <div class="instance-card__version">{{ getInstanceVersion(instance) }}</div>
          </div>
        </div>

        <!-- News Section (Improved) -->
        <div v-if="allNews.length > 0" class="launcher-news mt-8">
          <h2 class="news-title">{{ t('me.news') }}</h2>
          <div class="news-grid">
            <div
              v-for="n in allNews.slice(0, 4)"
              :key="n.title"
              class="news-card"
              @click="openInBrowser(n.link)"
            >
              <v-img
                :src="n.image.url"
                :aspect-ratio="16 / 9"
                class="news-image"
                cover
              >
                <template v-slot:placeholder>
                  <v-row class="fill-height ma-0" align="center" justify="center">
                    <v-progress-circular indeterminate color="grey lighten-5"></v-progress-circular>
                  </v-row>
                </template>
              </v-img>
              <div class="news-content">
                <div class="news-category" v-if="n.category">{{ n.category }}</div>
                <div class="news-card-title">{{ n.title }}</div>
                <div class="news-date">{{ getDateString(n.date, { dateStyle: 'medium' }) }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </transition>
</template>

<script lang="ts" setup>
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n-bridge'
import { useInjectInstanceLauncher } from '@/composables/instanceLauncher'
import { useDialog } from '@/composables/dialog'
import { AddInstanceDialogKey } from '@/composables/instanceTemplates'
import { kInstances } from '@/composables/instances'
import { injection } from '@/util/inject'
import { useRouter } from 'vue-router/composables'
import { useMojangNews } from '@/composables/mojangNews'
import { LauncherNews, useLauncherNews } from '@/composables/launcherNews'
import { useDateString } from '@/composables/date'
import { getInstanceIcon } from '@/util/favicon'

const { t } = useI18n()
const { isOpen, close } = useInjectInstanceLauncher()
const { show: showAddInstance } = useDialog(AddInstanceDialogKey)
const { instances, selectedInstance } = injection(kInstances)
const router = useRouter()
const { news } = useMojangNews()
const { news: launcherNews } = useLauncherNews()
const { getDateString } = useDateString()

const props = defineProps<{
  embedded?: boolean
}>()

const searchQuery = ref('')

const allNews = computed((): LauncherNews[] => {
  const result: LauncherNews[] = [
    ...launcherNews.value,
    ...news.value.map((n) => ({
      title: n.title,
      category: n.tag,
      date: n.date,
      description: n.text,
      image: {
        url: n.newsPageImage.url,
        width: n.newsPageImage.dimensions.width,
        height: n.newsPageImage.dimensions.height,
      },
      link: n.readMoreLink,
    })),
  ]
  return result.sort((a, b) => Date.parse(b.date) - Date.parse(a.date))
})

const filteredInstances = computed(() => {
  if (!searchQuery.value) {
    return instances.value
  }
  const query = searchQuery.value.toLowerCase()
  return instances.value.filter((inst: any) => {
    const name = (inst.name || '').toLowerCase()
    const version = getInstanceVersion(inst).toLowerCase()
    return name.includes(query) || version.includes(query)
  })
})

function getInstanceVersion(instance: any) {
  return instance?.runtime?.minecraft || instance?.version || ''
}

function handleCreateInstance() {
  close()
  showAddInstance()
}

function handleSelectInstance(instancePath: string) {
  // Set the selected instance path first
  selectedInstance.value = instancePath
  close()
  router.push('/')
}

function openInBrowser(url: string) {
  window.open(url, '_blank', 'noopener,noreferrer')
}

// Auto-focus on open
watch(isOpen, (open) => {
  if (open) {
    searchQuery.value = ''
    setTimeout(() => {
      const overlay = document.querySelector('.instance-launcher-overlay') as HTMLElement
      overlay?.focus()
    }, 100)
  }
})
</script>

<style scoped>
.instance-launcher-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.85);
  backdrop-filter: blur(20px);
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  outline: none;
}

.instance-launcher-overlay--embedded {
  position: relative;
  background: transparent;
  backdrop-filter: none;
  z-index: 1;
  padding: 0;
  height: 100%;
}

.instance-launcher-container {
  width: 100%;
  max-width: 1200px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.instance-launcher-container--embedded {
  max-height: none;
  height: 100%;
  padding: 2rem;
}

.launcher-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.launcher-title {
  font-size: 2.5rem;
  font-weight: 700;
  color: white;
  margin: 0;
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
}

.close-btn {
  background: rgba(255, 255, 255, 0.1) !important;
  transition: all 0.3s ease;
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.2) !important;
  transform: scale(1.1);
}

.launcher-search {
  max-width: 600px;
  margin: 0 auto;
  width: 100%;
}

.search-input {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 12px;
}

.launcher-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 1.5rem;
  overflow-y: auto;
  padding: 1rem 0;
  max-height: calc(90vh - 200px);
}

.instance-card {
  background: rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  padding: 1.5rem 1rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  border: 2px solid transparent;
}

.instance-card:hover {
  background: rgba(255, 255, 255, 0.12);
  transform: translateY(-4px) scale(1.05);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
}

.instance-card--active {
  border-color: var(--color-primary);
  background: rgba(var(--color-primary-rgb), 0.15);
}

.instance-card--create {
  background: rgba(76, 175, 80, 0.15);
  border: 2px dashed rgba(76, 175, 80, 0.5);
}

.instance-card--create:hover {
  background: rgba(76, 175, 80, 0.25);
  border-color: rgba(76, 175, 80, 0.8);
}

.instance-card__icon {
  width: 64px;
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  overflow: hidden;
}

.instance-icon {
  border-radius: 12px;
  transition: transform 0.3s ease;
}

.instance-card:hover .instance-icon {
  transform: scale(1.1);
}

.instance-card__name {
  font-size: 1rem;
  font-weight: 600;
  color: white;
  text-align: center;
  word-break: break-word;
  line-height: 1.3;
}

.instance-card__version {
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.6);
  text-align: center;
}

/* Animations */
.launcher-fade-enter-active,
.launcher-fade-leave-active {
  transition: opacity 0.3s ease;
}

.launcher-fade-enter-from,
.launcher-fade-leave-to {
  opacity: 0;
}

.launcher-fade-enter-active .instance-launcher-container {
  animation: launcher-slide-up 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

@keyframes launcher-slide-up {
  from {
    opacity: 0;
    transform: translateY(30px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

/* Scrollbar styling */
.launcher-grid::-webkit-scrollbar {
  width: 8px;
}

.launcher-grid::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 4px;
}

.launcher-grid::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 4px;
}

.launcher-grid::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.3);
}

/* News Section */
.launcher-news {
  width: 100%;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  padding-top: 2rem;
}

.news-title {
  font-size: 1.5rem;
  font-weight: 600;
  color: white;
  margin-bottom: 1.5rem;
}

.news-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1.5rem;
}

.news-card {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 16px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  flex-direction: column;
}

.news-card:hover {
  background: rgba(255, 255, 255, 0.12);
  transform: translateY(-6px);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.3);
}

.news-image {
  border-radius: 16px 16px 0 0;
  transition: transform 0.5s ease;
}

.news-card:hover .news-image {
  transform: scale(1.05);
}

.news-content {
  padding: 1.25rem;
  flex-grow: 1;
  display: flex;
  flex-direction: column;
}

.news-category {
  font-size: 0.75rem;
  color: var(--v-primary-base);
  text-transform: uppercase;
  font-weight: 700;
  margin-bottom: 0.5rem;
  letter-spacing: 0.5px;
}

.news-card-title {
  font-size: 1.1rem;
  font-weight: 700;
  color: white;
  line-height: 1.4;
  margin-bottom: 0.75rem;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.news-date {
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.5);
  margin-top: auto;
}
</style>
