<script lang="ts" setup>
import { useLocalStorageCacheBool } from "@/composables/cache";
import { useDateString } from "@/composables/date";
import { kInstance } from "@/composables/instance";
import { kInstances } from "@/composables/instances";
import { useMojangNews } from "@/composables/mojangNews";
import { LauncherNews, useLauncherNews } from "@/composables/launcherNews";
import { injection } from "@/util/inject";
import { getInstanceIcon } from "@/util/favicon";
import { ref, computed, Ref } from "vue";
import { useDialog } from "@/composables/dialog";
import { AddInstanceDialogKey } from "@/composables/instanceTemplates";
import { useRouter } from "vue-router/composables";
import { useInstanceGroup } from "@/composables/instanceGroup";
import { Instance } from "@xmcl/instance";
import { useLocalStorage } from '@vueuse/core';

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
const { groups } = useInstanceGroup();

// View mode: folder, date, or plain
const instanceViewMode = useLocalStorage('instanceViewMode', 'plain' as 'folder' | 'date' | 'plain');

const filteredInstances = computed(() =>
  [...instances.value].filter(v => v.name.toLocaleLowerCase().includes(filterKey.value.toLocaleLowerCase())).sort((a, b) => b.lastAccessDate - a.lastAccessDate)
);

// Create a map from instance path to instance
const instanceMap = computed(() => {
  const map = new Map<string, Instance>();
  for (const inst of filteredInstances.value) {
    map.set(inst.path, inst);
  }
  return map;
});

interface GroupedItem {
  type: 'group'
  id: string
  name: string
  color: string
  instances: Instance[]
}

// Get grouped instances
const groupedInstances = computed((): GroupedItem[] => {
  const result: GroupedItem[] = [];
  for (const item of groups.value) {
    if (typeof item === 'object') {
      const groupInstances: Instance[] = [];
      for (const instancePath of item.instances) {
        const inst = instanceMap.value.get(instancePath);
        if (inst) {
          groupInstances.push(inst);
        }
      }
      if (groupInstances.length > 0) {
        result.push({
          type: 'group',
          id: item.id,
          name: item.name,
          color: item.color,
          instances: groupInstances,
        });
      }
    }
  }
  return result;
});

// Get ungrouped instance paths
const groupedPaths = computed(() => {
  const paths = new Set<string>();
  for (const item of groups.value) {
    if (typeof item === 'object') {
      for (const instancePath of item.instances) {
        paths.add(instancePath);
      }
    }
  }
  return paths;
});

// Filter to only ungrouped instances
const ungroupedInstances = computed(() => {
  return filteredInstances.value.filter(inst => !groupedPaths.value.has(inst.path));
});

// Time-based grouping constants
const now = Date.now();
const oneDay = 1000 * 60 * 60 * 24;
const threeDays = oneDay * 3;

const timeGroupTitles = computed(() => [
  t('instanceAge.today'),
  t('instanceAge.threeDay'),
  t('instanceAge.older'),
]);

// Helper function to group instances by time
const groupByTime = (instances: Instance[]): Instance[][] => {
  const todayR: Instance[] = [];
  const threeR: Instance[] = [];
  const other: Instance[] = [];
  for (const p of instances) {
    const diff = now - p.lastAccessDate;
    if (diff <= oneDay) {
      todayR.push(p);
    } else if (diff <= threeDays) {
      threeR.push(p);
    } else {
      other.push(p);
    }
  }
  const result: Instance[][] = [];
  if (todayR.length > 0) result.push(todayR);
  if (threeR.length > 0) result.push(threeR);
  if (other.length > 0) result.push(other);
  return result;
};

const ungroupedByTime: Ref<Instance[][]> = computed(() => groupByTime(ungroupedInstances.value));
const instancesByTime: Ref<Instance[][]> = computed(() => groupByTime(filteredInstances.value));

// Unified data structure for both view modes
interface InstanceSection {
  id: string
  title: string
  icon: string
  instances: Instance[]
}

const instanceSections = computed((): InstanceSection[] => {
  if (instanceViewMode.value === 'folder') {
    const sections: InstanceSection[] = [];
    
    // Add manual groups
    for (const group of groupedInstances.value) {
      sections.push({
        id: `group-${group.id}`,
        title: group.name || t('instances.folder'),
        icon: 'folder',
        instances: group.instances,
      });
    }
    
    // Add ungrouped instances directly
    if (ungroupedInstances.value.length > 0) {
      sections.push({
        id: 'ungrouped',
        title: ' ',
        icon: 'view_list',
        instances: ungroupedInstances.value,
      });
    }

    return sections;
  } else if (instanceViewMode.value === 'date') {
    // Date view mode - all instances by time
    const sections: InstanceSection[] = [];
    const timeGroups = instancesByTime.value;
    timeGroups.forEach((timeGroup, i) => {
      if (timeGroup.length > 0) {
        sections.push({
          id: `time-${i}`,
          title: timeGroupTitles.value[i],
          icon: 'schedule',
          instances: timeGroup,
        });
      }
    });
    
    return sections;
  } else {
    // Plain view mode - all instances in one list
    return [{
      id: 'plain',
      title: '',
      icon: 'view_list',
      instances: filteredInstances.value,
    }];
  }
});

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
</script>

<template>
  <div ref="container" class="my-stuff-page h-full overflow-auto">
    <div class="classic-container">

      <!-- News Section (Hero Style) -->
      <section v-if="true && allNews.length > 0" class="news-section">
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
            <h2 class="section-title">{{ t('instance.current', 2) }}</h2>
          </div>
          <div class="d-flex align-center gap-2">
            <v-btn-toggle
              v-model="instanceViewMode"
              mandatory
              dense
              class="mr-2"
            >
              <v-btn small value="folder">
                <v-icon small>folder</v-icon>
              </v-btn>
              <v-btn small value="date">
                <v-icon small>schedule</v-icon>
              </v-btn>
              <v-btn small value="plain">
                <v-icon small>view_list</v-icon>
              </v-btn>
            </v-btn-toggle>
            <v-btn color="primary" @click="openAddInstanceDialog" small depressed>
              <v-icon left small>add</v-icon>
              {{ t("instances.add") }}
            </v-btn>
          </div>
        </div>

        <v-text-field
          v-model="filterKey"
          :placeholder="t('shared.filter')"
          prepend-inner-icon="search"
          outlined
          dense
          hide-details
          class="search-field mb-4"
        />

        <!-- Unified Instance Sections -->
        <div v-for="section in instanceSections" :key="section.id" class="mb-6">
          <div v-if="section.title" class="section-header-item mb-3">
            <v-icon small class="mr-2">{{ section.icon }}</v-icon>
            <span class="section-title-item">{{ section.title }}</span>
            <span class="section-count">({{ section.instances.length }})</span>
          </div>
          <div class="instances-grid">
            <div
              v-for="instance in section.instances"
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
        </div>
      </section>
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
  color: rgba(0, 0, 0, 0.9);
}

.dark .section-title {
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
  background: linear-gradient(to right, transparent, rgba(255, 255, 255, 0.9));
}

.dark .news-gradient {
  background: linear-gradient(to right, transparent, rgba(30, 30, 30, 1));
}

.news-info {
  flex: 1;
  padding: 24px 32px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  background: rgba(255, 255, 255, 0.95);
}

.dark .news-info {
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
  color: rgba(0, 0, 0, 0.3);
}

.dark .news-dot {
  color: rgba(255, 255, 255, 0.3);
}

.news-date {
  color: rgba(0, 0, 0, 0.5);
  font-size: 0.75rem;
}

.dark .news-date {
  color: rgba(255, 255, 255, 0.5);
}

.news-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: rgba(0, 0, 0, 1);
  margin: 0 0 12px 0;
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.dark .news-title {
  color: white;
}

.news-description {
  color: rgba(0, 0, 0, 0.7);
  font-size: 0.9rem;
  line-height: 1.5;
  margin: 0 0 16px 0;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.dark .news-description {
  color: rgba(255, 255, 255, 0.7);
}

.news-read-more {
  align-self: flex-start;
}

.instances-section {
  width: 100%;
  user-select: none;
}

.search-field {
  max-width: 400px;
  border-radius: 8px;
}

.group-header,
.time-header {
  display: flex;
  align-items: center;
  font-size: 1rem;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.7);
}

.dark .group-header,
.dark .time-header {
  color: rgba(255, 255, 255, 0.7);
}

.group-title,
.time-title {
  font-size: 1rem;
}

.group-count {
  margin-left: 8px;
  font-size: 0.875rem;
  color: rgba(0, 0, 0, 0.5);
}

.dark .group-count {
  color: rgba(255, 255, 255, 0.5);
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
  background: rgba(0, 0, 0, 0.04);
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.dark .instance-item {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.instance-item:hover {
  background: rgba(0, 0, 0, 0.08);
  border-color: rgba(0, 0, 0, 0.15);
  transform: translateY(-2px);
}

.dark .instance-item:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.15);
}

.section-header-item {
  display: flex;
  align-items: center;
  font-size: 1rem;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.7);
}

.dark .section-header-item {
  color: rgba(255, 255, 255, 0.7);
}

.section-title-item {
  font-size: 1rem;
}

.section-count {
  margin-left: 8px;
  font-size: 0.875rem;
  color: rgba(0, 0, 0, 0.5);
}

.dark .section-count {
  color: rgba(255, 255, 255, 0.5);
}

.dark .sectionnce-name {
  color: rgba(255, 255, 255, 0.9);
}

.instance-version {
  font-size: 0.8rem;
  color: rgba(0, 0, 0, 0.5);
}

.dark .instance-version {
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
