<template>
  <div
    ref="container"
    class="visible-scroll h-full select-none overflow-auto pb-8"
    @wheel="onWheel"
  >
    <div class="z-2 relative flex w-full flex-col py-4" @dragover.prevent>
      <!-- News Section (Large Banner + Scroller) -->
      <section class="mb-6 px-4 md:px-6">
        <MeSectionHeader :title="t('me.news')">
          <template #extra>
            <v-btn
              id="hide-news-button"
              v-shared-tooltip.left="
                () =>
                  displayNewsHeader
                    ? t('setting.hideNewsHeader')
                    : t('setting.showNewsHeader')
              "
              icon
              text
              @click="displayNewsHeader = !displayNewsHeader"
            >
              <v-icon>{{
                displayNewsHeader ? "visibility_off" : "visibility"
              }}</v-icon>
            </v-btn>
          </template>
        </MeSectionHeader>

        <transition name="fade-transition" mode="out-in">
          <div v-if="displayNewsHeader" class="mt-4">
            <!-- Large news banner -->
            <div
              v-if="currentNews"
              :key="currentNews.title"
              class="rounded-lg bg-white/5 dark:bg-black/20 p-6 shadow-md mb-6 min-h-[380px] flex flex-col justify-center"
            >
              <div
                class="text-4xl lg:text-5xl font-bold"
                style="letter-spacing: 1px"
              >
                {{ currentNews.title }}
              </div>
              <div class="mt-3 text-md text-gray-600 dark:text-gray-400">
                {{ getDateString(currentNews?.date, { dateStyle: "long" }) }}
              </div>
              <div class="mt-3 text-lg">
                {{ currentNews?.description }}
              </div>
              <div class="mt-5">
                <v-btn
                  color="primary"
                  large
                  @click="openInBrowser(currentNews.link)"
                >
                  {{ t("news.readMore") }}
                </v-btn>
              </div>
            </div>

            <!-- Horizontal news scroller -->
            <div
              ref="newsContainer"
              class="flex w-full gap-4 overflow-x-auto overflow-y-hidden p-2"
              @wheel.stop="onNewsWheel"
            >
              <div
                v-for="(n, i) of allNews"
                :key="n.title"
                class="flex-shrink-0 w-72 cursor-pointer rounded-md bg-white/5 dark:bg-black/10 p-3 transition-all duration-200 hover:shadow-xl hover:bg-white/10 dark:hover:bg-black/20"
                @mouseenter="current = i"
                @click="openInBrowser(n.link)"
              >
                <div class="flex justify-between items-center mb-2">
                  <v-chip label outlined small>
                    <v-icon left small> event </v-icon>
                    {{ getDateString(n.date, { dateStyle: "long" }) }}
                  </v-chip>
                  <v-chip
                    v-if="n.category"
                    label
                    color="primary"
                    outlined
                    small
                  >
                    {{ n.category }}
                  </v-chip>
                </div>
                <v-img
                  class="rounded-lg"
                  :src="n.image.url"
                  :aspect-ratio="16 / 9"
                  cover
                >
                  <div
                    class="px-3 py-2 flex h-full w-full items-center justify-center bg-black/60 text-white text-center opacity-0 transition-all duration-300 hover:opacity-100"
                  >
                    <span class="text-sm">{{ n.description }}</span>
                  </div>
                </v-img>
                <div class="mt-2 text-md font-semibold truncate">
                  {{ n.title }}
                </div>
              </div>
            </div>
          </div>
        </transition>
      </section>

      <!-- "My Stuff" Section (Games, Versions, Modpacks) -->
      <section class="mt-4 px-4 md:px-6">
        <MeSectionHeader
          id="my-stuff-header"
          :title="options.find((o) => o.value === currentDisplaied)?.text ?? ''"
          :options="options"
          @select="currentDisplaied = $event"
        />
        <div class="mt-4">
          <InstancesCards
            v-if="currentDisplaied === ''"
            :instances="sorted"
            class="px-0"
            @select="onInstanceClick"
          />
          <ResourceManageModpack
            v-else-if="currentDisplaied === 'modpack'"
            class="mt-2"
          />
          <ResourceManageVersions
            v-else-if="currentDisplaied === 'version'"
            class="mt-2"
          />
        </div>
      </section>
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
import { useScrollRight } from "@/composables/scroll";
import { vSharedTooltip } from "@/directives/sharedTooltip";
import { injection } from "@/util/inject";
import { ref, computed, watch, onUnmounted } from "vue";
import MeSectionHeader from "./MeSectionHeader.vue";

import { useQuery } from "@/composables/query";
import InstancesCards from "./InstancesCards.vue";
import ResourceManageModpack from "./ResourceManageModpack.vue";
import ResourceManageVersions from "./ResourceManageVersions.vue";
import { useTutorial } from "@/composables/tutorial";
import { DriveStep } from "driver.js";
import { kTheme } from "@/composables/theme";

const currentDisplaied = useQuery("view");

const { t } = useI18n();
const { news } = useMojangNews();
const { news: launcherNews } = useLauncherNews();
const { backgroundImageOverride } = injection(kTheme);

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

const { getDateString } = useDateString();

const options = computed(() => [
  {
    text: t("me.games", 2),
    value: "",
    icon: "apps",
  },
  {
    text: t("me.versions", 2),
    value: "version",
    icon: "power",
  },
  {
    text: t("me.modpacks", 2),
    value: "modpack",
    icon: "inventory_2",
  },
]);

const displayNewsHeader = useLocalStorageCacheBool("displayNewsHeader", true);

const current = ref(0);
const currentNews = computed(() => allNews.value[current.value]);
const { instances } = injection(kInstances);
const sorted = computed(() =>
  [...instances.value].sort((a, b) => b.lastAccessDate - a.lastAccessDate)
);

watch(
  [displayNewsHeader, currentNews],
  ([showNews, cNews]) => {
    if (showNews && cNews) {
      backgroundImageOverride.value = cNews.image.url;
    } else {
      backgroundImageOverride.value = "";
    }
  },
  { immediate: true }
);

onUnmounted(() => {
  backgroundImageOverride.value = "";
});

const opacity = ref(1);

const newsContainer = ref<HTMLDivElement | null>(null);
const { onWheel: onNewsWheel } = useScrollRight(newsContainer);

const container = ref<HTMLDivElement | undefined>(undefined);
const onWheel = (e: WheelEvent) => {
  const element = container.value;
  if (!element) return;
  if (element.clientHeight === 0) return;

  const maxVal = element.scrollHeight - element.clientHeight;
  if (maxVal === 0) {
    opacity.value = 1;
    return;
  }
  const currentVal = element.scrollTop;
  opacity.value = 1 - currentVal / maxVal;
};

const { path } = injection(kInstance);
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

// Tutorial
useTutorial(
  computed(() => {
    const steps: DriveStep[] = [
      {
        element: "#hide-news-button",
        popover: {
          title: t("setting.hideNewsHeader"),
          description: t("tutorial.hideNewsHeaderDescription"),
        },
      },
      {
        element: "#my-stuff-header",
        popover: {
          title: t("me.recentPlay"),
          description: t("tutorial.recentPlayDescription"),
        },
      },
    ];
    return steps;
  })
);
</script>

<style scoped>
/* visible-scroll and other global styles are assumed to be defined elsewhere */
.visible-scroll::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

.visible-scroll::-webkit-scrollbar-thumb {
  background-color: rgba(128, 128, 128, 0.5);
  border-radius: 4px;
}

.visible-scroll::-webkit-scrollbar-track {
  background-color: transparent;
}

/* Transition for fade */
.fade-transition-enter-active,
.fade-transition-leave-active {
  transition: opacity 0.3s ease;
}

.fade-transition-enter-from,
.fade-transition-leave-to {
  opacity: 0;
}
</style>
