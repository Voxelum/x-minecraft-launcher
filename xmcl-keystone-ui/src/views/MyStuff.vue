<template>
  <div
    ref="container"
    class="instance-launcher-page h-full overflow-auto pb-8"
  >
    <div class="launcher-page-container">
      <!-- Header -->
      <div class="launcher-page-header">
        <h1 class="launcher-page-title">{{ t('instanceLauncher.title') }}</h1>
        <v-text-field
          v-model="filterKey"
          outlined
          dense
          hide-details
          class="search-field"
          prepend-inner-icon="search"
          :placeholder="t('instanceLauncher.search')"
        ></v-text-field>
      </div>

      <!-- Instance Grid -->
      <div class="launcher-page-grid">
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
          :class="{ 'instance-card--active': instance.path === path }"
          @click="onInstanceClick(instance.path)"
        >
          <div class="instance-card__icon">
            <v-img
              :src="instance.icon"
              :width="64"
              :height="64"
              class="instance-icon"
            />
          </div>
          <div class="instance-card__name">{{ instance.name }}</div>
          <div class="instance-card__version">{{ instance.runtime?.minecraft || instance.version || '' }}</div>
        </div>
      </div>

      <!-- News Section (Compact) -->
      <div v-if="displayNewsHeader && allNews.length > 0" class="launcher-page-news">
        <div class="news-header">
          <h2 class="news-title">{{ t('me.news') }}</h2>
          <v-btn
            icon
            small
            @click="displayNewsHeader = false"
          >
            <v-icon small>visibility_off</v-icon>
          </v-btn>
        </div>
        <div class="news-grid-compact">
          <div
            v-for="n in allNews.slice(0, 6)"
            :key="n.title"
            class="news-card-compact"
            @click="openInBrowser(n.link)"
          >
            <v-img
              :src="n.image.url"
              :aspect-ratio="16 / 9"
              class="news-image-compact"
              cover
            />
            <div class="news-content-compact">
              <div class="news-category-compact" v-if="n.category">{{ n.category }}</div>
              <div class="news-card-title-compact">{{ n.title }}</div>
              <div class="news-date-compact">{{ getDateString(n.date, { dateStyle: 'medium' }) }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { useLocalStorageCacheBool } from "@/composables/cache";
import { useDateString } from "@/composables/date";
import { kInstance } from "@/composables/instance";
import { kInstances } from "@/composables/instances";
import { useMojangNews } from "@/composables/mojangNews";
import { LauncherNews, useLauncherNews } from "@/composables/launcherNews";
import { injection } from "@/util/inject";
import { ref, computed } from "vue";
import { useDialog } from "@/composables/dialog";
import { AddInstanceDialogKey } from "@/composables/instanceTemplates";

const { t } = useI18n();
const { news } = useMojangNews();
const { news: launcherNews } = useLauncherNews();
const { getDateString } = useDateString();

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

const { show: showAddInstance } = useDialog(AddInstanceDialogKey);
const handleCreateInstance = () => {
  showAddInstance();
};

const { push, currentRoute } = useRouter();
const onInstanceClick = (instancePath: string) => {
  if (currentRoute.path === "/") {
    path.value = instancePath;
  } else {
    path.value = instancePath;
    push("/");
  }
};

const openInBrowser = (url: string) => {
  window.open(url, "_blank", "noopener,noreferrer");
};
</script>

<style scoped>
.instance-launcher-page {
  padding: 2rem;
}

.launcher-page-container {
  max-width: 1400px;
  margin: 0 auto;
}

.launcher-page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 2rem;
  gap: 2rem;
}

.launcher-page-title {
  font-size: 2.5rem;
  font-weight: 700;
  margin: 0;
}

.search-field {
  max-width: 400px;
}

.launcher-page-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 1.5rem;
  margin-bottom: 3rem;
}

/* Instance Cards */
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
  border-color: var(--v-primary-base);
  background: rgba(76, 175, 80, 0.15);
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
  font-size: 0.95rem;
  font-weight: 600;
  text-align: center;
  word-break: break-word;
  line-height: 1.3;
}

.instance-card__version {
  font-size: 0.75rem;
  opacity: 0.6;
  text-align: center;
}

/* News Section */
.launcher-page-news {
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  padding-top: 2rem;
}

.news-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
}

.news-title {
  font-size: 1.5rem;
  font-weight: 600;
  margin: 0;
}

.news-grid-compact {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 1rem;
}

.news-card-compact {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.3s ease;
}

.news-card-compact:hover {
  background: rgba(255, 255, 255, 0.1);
  transform: translateY(-4px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.news-image-compact {
  border-radius: 12px 12px 0 0;
}

.news-content-compact {
  padding: 0.75rem;
}

.news-category-compact {
  font-size: 0.7rem;
  color: var(--v-primary-base);
  text-transform: uppercase;
  font-weight: 600;
  margin-bottom: 0.25rem;
}

.news-card-title-compact {
  font-size: 0.85rem;
  font-weight: 600;
  line-height: 1.3;
  margin-bottom: 0.5rem;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.news-date-compact {
  font-size: 0.7rem;
  opacity: 0.5;
}
</style>
