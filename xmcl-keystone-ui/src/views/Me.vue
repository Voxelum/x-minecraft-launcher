<script lang="ts" setup>
import { useLocalStorageCacheBool, useLocalStorageCacheStringValue } from "@/composables/cache";
import { useDateString } from "@/composables/date";
import { kInstance } from "@/composables/instance";
import { kInstances } from "@/composables/instances";
import { useMojangNews } from "@/composables/mojangNews";
import { LauncherNews, useLauncherNews } from "@/composables/launcherNews";
import { injection } from "@/util/inject";
import { getInstanceIcon } from "@/util/favicon";
import { ref, computed, onMounted, watch } from "vue";
import { useDialog } from "@/composables/dialog";
import { AddInstanceDialogKey } from "@/composables/instanceTemplates";
import { useInjectInstanceLauncher } from "@/composables/instanceLauncher";
import { useRouter } from "vue-router/composables";

const { t } = useI18n();
const { news } = useMojangNews();
const { news: launcherNews } = useLauncherNews();
const { getDateString } = useDateString();
const { open: openLauncher, isOpen: launcherActive } = useInjectInstanceLauncher();

// My Stuff Style Setting
const myStuffStyle = useLocalStorageCacheStringValue<'old' | 'new'>('myStuffStyle', 'new');
const isOldStyle = computed(() => myStuffStyle.value === 'old');

// Handler to open launcher in new style
function handleOpenLauncher() {
  openLauncher()
}

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
  ];
  return result.sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
});

const filterKey = ref("");
const displayNewsHeader = useLocalStorageCacheBool("displayNewsHeader", true);
const { instances } = injection(kInstances);
const { path } = injection(kInstance);

const filteredInstances = computed(() =>
  [...instances.value].filter(v => v.name.toLocaleLowerCase().includes(filterKey.value.toLocaleLowerCase())).sort((a, b) => b.lastAccessDate - a.lastAccessDate)
);

const { show: openAddInstanceDialog } = useDialog(AddInstanceDialogKey);

const router = useRouter();

function selectInstance(instancePath: string) {
  path.value = instancePath
  if (router.currentRoute.path !== '/') {
    router.push('/')
  }
}

function openInBrowser(url: string) {
  window.open(url, "_blank", "noopener,noreferrer");
}

// Handle New Style (Launcher)
function handleNewStyle() {
  if (!isOldStyle.value) {
    openLauncher();
  }
}

onMounted(() => {
  handleNewStyle();
});

watch(myStuffStyle, () => {
  handleNewStyle();
});

watch(launcherActive, (isActive) => {
  if (!isActive && !isOldStyle.value) {
    const currentPath = router.currentRoute.path;
    if (currentPath === '/' || currentPath === '/me') {
      router.back();
    }
  }
});
</script>

<template>
  <div ref="container" class="my-stuff-page h-full overflow-auto">
    <!-- OLD STYLE: Classic My Stuff Page -->
    <div v-if="isOldStyle" class="classic-container">
      
      <!-- News Section (Hero Style) -->
      <section v-if="displayNewsHeader && allNews.length > 0" class="news-section">
        <div class="section-header">
          <v-icon class="section-icon" color="primary">article</v-icon>
          <h2 class="section-title">{{ t("news.name") }}</h2>
        </div>
        
        <div class="news-carousel-wrapper">
          <v-carousel
            height="280"
            hide-delimiter-background
            show-arrows-on-hover
            cycle
            :interval="6000"
            class="news-carousel"
          >
            <v-carousel-item 
              v-for="(item, index) in allNews.slice(0, 8)" 
              :key="index"
            >
              <div class="news-slide" @click="openInBrowser(item.link)">
                <div class="news-image-wrapper">
                  <v-img
                    :src="item.image.url"
                    height="280"
                    cover
                    class="news-image"
                  >
                    <template v-slot:placeholder>
                      <div class="d-flex align-center justify-center fill-height">
                        <v-progress-circular indeterminate color="primary"></v-progress-circular>
                      </div>
                    </template>
                  </v-img>
                  <div class="news-gradient"></div>
                </div>
                <div class="news-info">
                  <div class="news-meta">
                    <span class="news-category">{{ item.category }}</span>
                    <span class="news-dot">•</span>
                    <span class="news-date">{{ getDateString(item.date, { dateStyle: 'medium' }) }}</span>
                  </div>
                  <h3 class="news-title">{{ item.title }}</h3>
                  <p class="news-description">{{ item.description }}</p>
                  <v-btn text color="primary" small class="news-read-more">
                    {{ t("news.readMore") }}
                    <v-icon right small>open_in_new</v-icon>
                  </v-btn>
                </div>
              </div>
            </v-carousel-item>
          </v-carousel>
        </div>
      </section>

      <!-- Instances Section -->
      <section class="instances-section">
        <div class="section-header">
          <div class="d-flex align-center">
            <v-icon class="section-icon" color="primary">apps</v-icon>
            <h2 class="section-title">{{ t("instance.name", 2) }}</h2>
          </div>
          <v-btn color="primary" @click="openAddInstanceDialog" small depressed>
            <v-icon left small>add</v-icon>
            {{ t("instanceLauncher.createNew") }}
          </v-btn>
        </div>

        <v-text-field
          v-model="filterKey"
          :placeholder="t('instanceLauncher.search')"
          prepend-inner-icon="search"
          outlined
          dense
          hide-details
          class="search-field mb-4"
        />

        <div class="instances-grid">
          <div
            v-for="instance in filteredInstances"
            :key="instance.path"
            class="instance-item"
            :class="{ 'instance-item--active': instance.path === path }"
            @click="selectInstance(instance.path)"
          >
            <v-avatar size="44" class="instance-avatar">
              <v-img :src="getInstanceIcon(instance, undefined)" />
            </v-avatar>
            <div class="instance-info">
              <div class="instance-name">{{ instance.name }}</div>
              <div class="instance-version">{{ instance.runtime.minecraft }}</div>
            </div>
          </div>
        </div>
      </section>
    </div>

    <!-- NEW STYLE: Show button to open launcher -->
    <div
      v-else
      class="flex h-full w-full items-center justify-center"
      :class="{ 'hidden': launcherActive }"
    >
      <v-btn large color="primary" @click="handleOpenLauncher">
        <v-icon left>apps</v-icon>
        {{ t("instanceLauncher.showAll") }}
      </v-btn>
    </div>
  </div>
</template>

<style scoped>
.my-stuff-page {
  background: transparent;
}

.classic-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 32px;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.section-icon {
  margin-right: 12px;
}

.section-title {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0;
  color: rgba(255, 255, 255, 0.9);
}

.news-section {
  width: 100%;
}

.news-carousel-wrapper {
  border-radius: 16px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.03);
}

.news-carousel {
  border-radius: 16px;
}

.news-slide {
  position: relative;
  height: 100%;
  cursor: pointer;
  display: flex;
  transition: transform 0.3s ease;
}

.news-slide:hover {
  transform: scale(1.01);
}

.news-image-wrapper {
  position: relative;
  width: 55%;
  flex-shrink: 0;
}

.news-image {
  height: 100%;
}

.news-gradient {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 100px;
  background: linear-gradient(to right, transparent, rgba(30, 30, 30, 1));
}

.news-info {
  flex: 1;
  padding: 24px 32px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  background: rgba(30, 30, 30, 0.95);
}

.news-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.news-category {
  color: var(--v-primary-base);
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.news-dot {
  color: rgba(255, 255, 255, 0.3);
}

.news-date {
  color: rgba(255, 255, 255, 0.5);
  font-size: 0.75rem;
}

.news-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: white;
  margin: 0 0 12px 0;
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.news-description {
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.9rem;
  line-height: 1.5;
  margin: 0 0 16px 0;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.news-read-more {
  align-self: flex-start;
}

.instances-section {
  width: 100%;
}

.search-field {
  max-width: 400px;
  border-radius: 8px;
}

.instances-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 12px;
}

.instance-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.instance-item:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.15);
  transform: translateY(-2px);
}

.instance-item--active {
  background: rgba(76, 175, 80, 0.15);
  border-color: var(--v-primary-base);
}

.instance-avatar {
  flex-shrink: 0;
}

.instance-info {
  flex: 1;
  min-width: 0;
}

.instance-name {
  font-weight: 600;
  font-size: 0.95rem;
  color: rgba(255, 255, 255, 0.9);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.instance-version {
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.5);
}

@media (max-width: 768px) {
  .classic-container {
    padding: 16px;
    gap: 24px;
  }

  .news-slide {
    flex-direction: column;
  }

  .news-image-wrapper {
    width: 100%;
    height: 160px;
  }

  .news-gradient {
    display: none;
  }

  .news-info {
    padding: 16px;
  }

  .news-title {
    font-size: 1.2rem;
  }

  .instances-grid {
    grid-template-columns: 1fr;
  }
}
</style>
