import { sort as sortFunc } from "@/composables/sortBy";
import { ModFile } from "@/util/mod";
import { ProjectEntry, ProjectFile } from "@/util/search";
import {
  InstanceContentGroupType,
  InstanceModsGroupServiceKey,
  InstanceModsGroupState,
  ModGroupData,
  normalizeModFileName,
} from "@xmcl/runtime-api";
import { ContextMenuItem } from "./contextMenu";
import { useService } from "./service";
import { useState } from "./syncableState";
import { Ref, computed, ref, shallowRef, watch, onMounted, onBeforeUnmount, markRaw } from "vue";

export type ProjectGroup<T extends ProjectFile = ProjectFile> = {
  name: string;
  projects: ProjectEntry<T>[];
  mtime: number;
  color?: string;
  icon?: string;
  pinned?: boolean;
};

export type GroupableProjectFile = ProjectFile & { fileName: string };

export function useModGroups<T extends GroupableProjectFile = ModFile>(
  isLocalView: Ref<boolean>,
  path: Ref<string>,
  items: Ref<ProjectEntry<T>[]>,
  sortBy: Ref<string>,
  contentType: InstanceContentGroupType = "mods",
) {
  const {
    getGroupState,
    updateModsGroups,
    getSharedGroupRules,
    updateSharedGroupRules,
  } = useService(InstanceModsGroupServiceKey);
  const { state } = useState(
    () => getGroupState(path.value, contentType),
    InstanceModsGroupState
  );

  onMounted(() => {
    if (contentType !== "mods") return;
    const cache = localStorage.getItem("modsGrouping");
    if (cache) {
      const parsed = JSON.parse(cache) as Record<
        string,
        Record<string, string>
      >;
      for (const [path, fileToGroup] of Object.entries(parsed)) {
        const result = {} as Record<string, ModGroupData>;
        for (const [file, group] of Object.entries(fileToGroup)) {
          if (!result[group]) {
            result[group] = { color: "", files: [] };
          }
          result[group].files.push(file);
        }
        updateModsGroups(path, result, contentType);
      }
      localStorage.removeItem("modsGrouping");
    }
  });

  const instanceModGroupping = computed({
    get: () => state.value?.groups ?? {},
    set: (v) => {
      updateModsGroups(path.value, v, contentType);
    },
  });

  const { t, locale } = useI18n();
  const getGroupRuleId = (file: T) =>
    contentType === "mods" && "modId" in file && typeof file.modId === "string"
      ? file.modId
      : undefined;

  type GroupOrProject = ProjectGroup<T> | ProjectEntry<T>;

  // Persistent group collapsed state using localStorage with instance path as key
  const getStorageKey = () => `${contentType}GroupsCollapsed:${path.value}`;
  const loadCollapsedState = (): Record<string, boolean> => {
    try {
      const stored = localStorage.getItem(getStorageKey());
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  };

  const groupCollapsedState = shallowRef(loadCollapsedState());

  // Persist before an instance switch can change the storage key.
  watch(groupCollapsedState, (newState) => {
    try {
      localStorage.setItem(getStorageKey(), JSON.stringify(newState));
    } catch (error) {
      console.warn("Failed to save group collapsed state:", error);
    }
  }, { flush: "sync" });

  // Watch for path changes and reload state for new instance
  watch(path, () => {
    groupCollapsedState.value = loadCollapsedState();
  }, { flush: "sync" });

  // Toggle group collapsed state with proper reactivity
  function toggleGroupCollapsed(groupName: string) {
    groupCollapsedState.value = {
      ...groupCollapsedState.value,
      [groupName]: !groupCollapsedState.value[groupName],
    };
  }

  const groupNames = computed(() => Object.keys(instanceModGroupping.value));

  const isAllCollapsed = computed(() => {
    if (groupNames.value.length === 0) return false;
    return groupNames.value.every((g) => !!groupCollapsedState.value[g]);
  });

  function toggleCollapseAll() {
    const willCollapse = !isAllCollapsed.value;
    const next: Record<string, boolean> = { ...groupCollapsedState.value };
    for (const g of groupNames.value) {
      next[g] = willCollapse;
    }
    groupCollapsedState.value = next;
  }

  function expandAll() {
    const next: Record<string, boolean> = { ...groupCollapsedState.value };
    for (const g of groupNames.value) {
      next[g] = false;
    }
    groupCollapsedState.value = next;
  }

  function collapseAll() {
    const next: Record<string, boolean> = { ...groupCollapsedState.value };
    for (const g of groupNames.value) {
      next[g] = true;
    }
    groupCollapsedState.value = next;
  }

  const collapseAllGroups = collapseAll;

  function group(fileNames: string[], customName?: string) {
    const newVal = { ...instanceModGroupping.value };
    const normalizedFileNames = fileNames.map(normalizeModFileName);
    const newGroupName = customName || normalizedFileNames.join(",");
    newVal[newGroupName] = {
      files: normalizedFileNames,
      color: "",
    };
    instanceModGroupping.value = newVal;

    // Ensure new groups start collapsed by default
    if (!(newGroupName in groupCollapsedState.value)) {
      groupCollapsedState.value = {
        ...groupCollapsedState.value,
        [newGroupName]: true, // true means collapsed
      };
    }
  }

  function addToGroup(fileNames: string[], groupName: string) {
    const newVal = { ...instanceModGroupping.value };
    const normalizedFileNames = fileNames.map(normalizeModFileName);

    // Check if target group exists
    const targetGroup = newVal[groupName];
    if (!targetGroup) {
      console.warn(
        `Group "${groupName}" does not exist. Files will not be moved.`
      );
      return;
    }

    // Remove from all groups first
    for (const group of Object.values(newVal)) {
      group.files = group.files.filter(
        (f) => !normalizedFileNames.includes(normalizeModFileName(f))
      );
    }

    // Add to selected group
    targetGroup.files.push(...normalizedFileNames);
    instanceModGroupping.value = newVal;
  }

  function renameGroup(oldName: string, newName: string) {
    if (oldName === newName) return;
    const newVal = { ...instanceModGroupping.value };
    const group = newVal[oldName];
    if (!group) return;
    delete newVal[oldName];
    newVal[newName] = group;
    instanceModGroupping.value = newVal;

    // Preserve collapsed state when renaming
    const collapsedState = groupCollapsedState.value[oldName];
    if (collapsedState !== undefined) {
      const newCollapsedState = { ...groupCollapsedState.value };
      delete newCollapsedState[oldName];
      newCollapsedState[newName] = collapsedState;
      groupCollapsedState.value = newCollapsedState;
    }
  }

  function updateGroupSetting(
    oldName: string,
    setting: { name?: string; color?: string; icon?: string; pinned?: boolean }
  ) {
    const newVal = { ...instanceModGroupping.value };
    const group = newVal[oldName];
    if (!group) return;

    const newName = setting.name || oldName;
    const updatedGroup: ModGroupData = {
      ...group,
      color: setting.color !== undefined ? setting.color : (group.color || ''),
      icon: setting.icon !== undefined ? setting.icon : group.icon,
      pinned: setting.pinned !== undefined ? setting.pinned : group.pinned,
    };

    if (oldName !== newName) {
      delete newVal[oldName];
      newVal[newName] = updatedGroup;

      const collapsedState = groupCollapsedState.value[oldName];
      if (collapsedState !== undefined) {
        const newCollapsedState = { ...groupCollapsedState.value };
        delete newCollapsedState[oldName];
        newCollapsedState[newName] = collapsedState;
        groupCollapsedState.value = newCollapsedState;
      }
    } else {
      newVal[oldName] = updatedGroup;
    }

    instanceModGroupping.value = newVal;
  }

  function toggleGroupPin(groupName: string) {
    const newVal = { ...instanceModGroupping.value };
    const group = newVal[groupName];
    if (!group) return;
    newVal[groupName] = {
      ...group,
      pinned: !group.pinned,
    };
    instanceModGroupping.value = newVal;
  }

  function sort(result: GroupOrProject[]) {
    // Separate groups from individual items
    const groups = result.filter(
      (item) => "projects" in item
    ) as ProjectGroup<T>[];
    const individuals = result.filter(
      (item) => !("projects" in item)
    ) as ProjectEntry<T>[];

    // Pinned groups sort first, then alphabetically by name (with numeric sorting)
    groups.sort((a, b) => {
      if (!!a.pinned !== !!b.pinned) {
        return a.pinned ? -1 : 1;
      }
      return a.name.localeCompare(b.name, undefined, {
        numeric: true,
        sensitivity: "base",
      });
    });

    // Apply user-selected sorting to individual items
    sortFunc(sortBy.value as any, individuals);

    // Return groups first, then individual items
    result.length = 0;
    result.push(...groups, ...individuals);
    return result;
  }

  const groupMap = computed(() => {
    const groupMap = {} as Record<string, string>;
    const currentGroup = instanceModGroupping.value;
    for (const [groupName, group] of Object.entries(currentGroup)) {
      for (const file of group.files) {
        // Map both original and normalized file names to handle disabled mods
        groupMap[file] = groupName;
        const normalized = normalizeModFileName(file);
        if (normalized !== file) {
          groupMap[normalized] = groupName;
        }
      }
    }
    return groupMap;
  });

  const localGroupedItems = computed(() => {
    if (!isLocalView.value) return [];
    const result = items.value;
    const resultByGroup = {} as Record<string, ProjectGroup<T>>;
    const ungrouped = [] as ProjectEntry<T>[];
    const _groupMap = groupMap.value;

    for (const i of result) {
      const fileName = i.installed?.[0]?.fileName;
      if (!fileName) continue;

      // Use normalized file name for group lookup to handle disabled mods
      const normalizedFileName = normalizeModFileName(fileName);
      const group = _groupMap[normalizedFileName];

      if (group) {
        if (!resultByGroup[group]) {
          const groupData = instanceModGroupping.value[group];
          resultByGroup[group] = {
            name: group,
            projects: [],
            mtime: 0,
            color: groupData?.color,
            icon: groupData?.icon,
            pinned: groupData?.pinned,
          };
        }
        resultByGroup[group].projects.push(i);
        resultByGroup[group].mtime = Math.max(
          resultByGroup[group].mtime,
          i.installed[0].mtime
        );
      } else {
        ungrouped.push(i);
      }
    }

    const sortableEntity: Array<GroupOrProject> = [
      ...Object.values(resultByGroup),
      ...ungrouped,
    ];

    sort(sortableEntity);

    for (const i of sortableEntity) {
      if ("projects" in i) {
        sort(i.projects);
      }
    }

    return sortableEntity;
  });

  function ungroup(groupName: string) {
    const newVal = { ...instanceModGroupping.value };
    const group = newVal[groupName];
    if (!group) return;
    delete newVal[groupName];
    instanceModGroupping.value = markRaw(newVal);

    // Clean up collapsed state when group is removed
    if (groupName in groupCollapsedState.value) {
      const newCollapsedState = { ...groupCollapsedState.value };
      delete newCollapsedState[groupName];
      groupCollapsedState.value = newCollapsedState;
    }
  }

  function getContextMenuItemsForGroup(
    proj: ProjectEntry<T>,
    showDialog?: (fileNames: string[]) => void
  ) {
    const fileName = proj.installed?.[0]?.fileName;
    if (!fileName) return [];

    const result = [] as ContextMenuItem[];

    if (contentType === "mods") {
      result.push({
        icon: "bookmarks",
        text: t("mod.applyGroupRules"),
        onClick: () => {
          applySharedGroupRules();
        },
      },
      {
        icon: "book",
        text: t("mod.syncGroupRules"),
        onClick: () => {
          syncGroupRules();
        },
      });
    }

    if (Object.values(instanceModGroupping.value).length === 0) {
      result.push({
        icon: "label",
        text: t("mod.group"),
        onClick: () => {
          if (showDialog) {
            showDialog([fileName]);
          } else {
            group([fileName]);
          }
        },
      });
      for (const item of result) {
        item.section = "group";
      }
      return result;
    }

    // Use dialog if provided, otherwise use children submenu
    if (showDialog) {
      result.push({
        icon: "label",
        text: t("mod.group"),
        onClick: () => {
          showDialog([normalizeModFileName(fileName)]);
        },
      });
    } else {
      result.push({
        icon: "label",
        text: t("mod.group"),
        onClick: () => {
          group([normalizeModFileName(fileName)]);
        },
        children: groupNames.value.map((g) => ({
          text: g,
          icon: "",
          onClick: () => {
            const newVal = { ...instanceModGroupping.value };
            const normalizedFileName = normalizeModFileName(fileName);
            for (const group of Object.values(newVal)) {
              group.files = group.files.filter(
                (f) => normalizeModFileName(f) !== normalizedFileName
              );
            }
            const group = newVal[g];
            group.files.push(normalizedFileName);
            instanceModGroupping.value = newVal;
          },
        })),
      });
    }

    if (isInGroup(fileName)) {
      result.push({
        icon: "label_off",
        text: t("mod.ungroup"),
        onClick: () => {
          const newVal = { ...instanceModGroupping.value };
          const normalizedFileName = normalizeModFileName(fileName);
          // Remove from all groups using normalized filename
          for (const group of Object.values(newVal)) {
            group.files = group.files.filter(
              (f) => normalizeModFileName(f) !== normalizedFileName
            );
          }
          instanceModGroupping.value = newVal;
        },
      });
    }

    for (const item of result) {
      item.section = "group";
    }
    return result;
  }

  function isInGroup(fileName?: string) {
    if (!fileName) return false;
    return groupMap.value[normalizeModFileName(fileName)] !== undefined;
  }

  function getGroupColor(fileName?: string) {
    if (!fileName) return "";
    const groupName = groupMap.value[normalizeModFileName(fileName)];
    if (!groupName) return "";
    const group = instanceModGroupping.value[groupName];
    if (!group) return "";
    return group.color;
  }

  function computeCurrentGroupRules() {
    const currentRules = {} as Record<string, string[]>;
    const result = items.value;
    for (const mod of result) {
      const file = mod.installed?.[0];
      if (!file) continue;
      const fileName = file.fileName;
      const normalizedFileName = normalizeModFileName(fileName);
      const group = groupMap.value[normalizedFileName];
      const groupRuleId = getGroupRuleId(file);
      if (group) {
        if (!currentRules[group]) {
          currentRules[group] = [];
        }
        if (groupRuleId && !currentRules[group].includes(groupRuleId)) {
          currentRules[group].push(groupRuleId);
        }
      }
    }
    return currentRules;
  }

  /**
   * Save the current instance grouping into the shared group rules.
   *
   * Merge rules:
   * - By default items in the same group are unioned. If the shared group X has
   *   [a, b, c] and the current instance group X has [c, d], the resulting shared
   *   group X is [a, b, c, d].
   * - However, if a mod is present in the current instance but is NOT assigned to
   *   that group in the instance, it is removed from the shared group. E.g. if the
   *   shared group X has [a, b, c], the instance group X has [c, d] and the mod `a`
   *   is installed in the current instance (but no longer grouped under X), then the
   *   resulting shared group X is [b, c, d].
   * - Shared mods that are not installed in the current instance are always kept,
   *   since we have no information to remove them.
   * - Groups that end up empty are removed from the shared rules.
   */
  async function syncGroupRules() {
    const shared = await getSharedGroupRules();
    const currentRules = computeCurrentGroupRules();

    // All mod ids installed in the current instance, regardless of their group
    const instanceModIds = new Set<string>();
    for (const mod of items.value) {
      const file = mod.installed?.[0];
      const groupRuleId = file ? getGroupRuleId(file) : undefined;
      if (groupRuleId) instanceModIds.add(groupRuleId);
    }

    const result = {} as Record<string, string[]>;
    const allGroupNames = new Set([
      ...Object.keys(shared),
      ...Object.keys(currentRules),
    ]);

    for (const name of allGroupNames) {
      const current = currentRules[name] ?? [];
      const existing = shared[name] ?? [];
      const set = new Set<string>(current);
      for (const modId of existing) {
        // Keep an existing shared mod unless the instance has it but moved it out
        // of this group (present in the instance and not in the current group).
        if (!instanceModIds.has(modId) || current.includes(modId)) {
          set.add(modId);
        }
      }
      if (set.size > 0) {
        result[name] = [...set];
      }
    }

    // Replace every considered group so that removals and emptied groups take
    // effect. Groups from other instances that are not touched here are preserved.
    await updateSharedGroupRules(result, [...allGroupNames]);
  }

  async function applySharedGroupRules() {
    const rules = await getSharedGroupRules();
    const newVal = { ...instanceModGroupping.value };
    const newlyCreatedGroups: string[] = [];

    const modIdToGroup = {} as Record<string, string>;
    for (const [groupName, group] of Object.entries(rules)) {
      for (const modId of group) {
        modIdToGroup[modId] = groupName;
      }
    }

    for (const i of items.value) {
      const file = i.installed?.[0];
      if (!file) continue;
      const modId = getGroupRuleId(file);
      if (!modId) continue;
      const fileName = file.fileName;
      const normalizedFileName = normalizeModFileName(fileName);
      const expectedGroup = modIdToGroup[modId];

      if (expectedGroup) {
        if (!newVal[expectedGroup]) {
          newVal[expectedGroup] = {
            files: [],
            color: "",
          };
          newlyCreatedGroups.push(expectedGroup);
        }
        const group = newVal[expectedGroup];
        // Store the normalized filename to handle disabled mods properly
        if (!group.files.includes(normalizedFileName)) {
          group.files.push(normalizedFileName);
        }
      } else {
        // Remove from all groups using normalized filename
        for (const group of Object.values(newVal)) {
          group.files = group.files.filter(
            (f) => normalizeModFileName(f) !== normalizedFileName
          );
        }
      }
    }

    instanceModGroupping.value = newVal;

    // Ensure newly created groups from rules start collapsed
    if (newlyCreatedGroups.length > 0) {
      const newCollapsedState = { ...groupCollapsedState.value };
      for (const groupName of newlyCreatedGroups) {
        if (!(groupName in newCollapsedState)) {
          newCollapsedState[groupName] = true; // true means collapsed
        }
      }
      groupCollapsedState.value = newCollapsedState;
    }
  }

  // Compute actual mod counts per group based on matching installed mods
  const groupModCounts = computed(() => {
    const counts = {} as Record<string, number>;
    const _groupMap = groupMap.value;
    
    for (const i of items.value) {
      const fileName = i.installed?.[0]?.fileName;
      if (!fileName) continue;
      
      const normalizedFileName = normalizeModFileName(fileName);
      const groupName = _groupMap[normalizedFileName];
      
      if (groupName) {
        counts[groupName] = (counts[groupName] || 0) + 1;
      }
    }
    
    return counts;
  });

  function autoCategorizeMods(): number {
    const result: Record<string, ModGroupData> = {};
    let count = 0;

    for (const i of items.value) {
      const fileName = i.installed?.[0]?.fileName;
      if (!fileName) continue;
      const cat = detectModCategory(i as any, t, locale.value);
      const groupName = cat.name;
      if (!result[groupName]) {
        result[groupName] = { files: [], color: cat.color, icon: cat.icon };
      }
      result[groupName].files.push(normalizeModFileName(fileName));
      count++;
    }

    instanceModGroupping.value = result;
    return count;
  }

  function ungroupAll() {
    instanceModGroupping.value = {};
    groupCollapsedState.value = {};
  }

  return {
    isInGroup,
    groups: groupNames,
    groupsRaw: instanceModGroupping,
    groupModCounts,
    syncGroupRules,
    applySharedGroupRules,
    getGroupColor,
    group,
    addToGroup,
    ungroup,
    ungroupAll,
    autoCategorizeMods,
    renameGroup,
    updateGroupSetting,
    toggleGroupPin,
    localGroupedItems,
    groupCollapsedState,
    toggleGroupCollapsed,
    isAllCollapsed,
    toggleCollapseAll,
    expandAll,
    collapseAll,
    collapseAllGroups,
    getContextMenuItemsForGroup,
  };
}

export const categoryTranslations: Record<string, Record<string, string>> = {
  'modCategory.optimization': {
    en: 'Optimization & Performance',
    uk: 'Оптимізація та продуктивність',
    'zh-CN': '优化与性能',
    'zh-HK': '優化與效能',
    'zh-TW': '最佳化與效能',
    ru: 'Оптимизация и производительность',
    de: 'Optimierung & Leistung',
    fr: 'Optimisation & Performance',
    'es-ES': 'Optimización y Rendimiento',
    'ja-JP': '最適化とパフォーマンス',
    ko: '최적화 및 성능',
    'pt-BR': 'Otimização e Desempenho',
    'it-IT': 'Ottimizzazione e Prestazioni',
    pl: 'Optymalizacja i wydajność',
  },
  'modCategory.libraries': {
    en: 'Libraries & APIs',
    uk: 'Бібліотеки та API',
    'zh-CN': '库与 API',
    'zh-HK': '程式庫與 API',
    'zh-TW': '程式庫與 API',
    ru: 'Библиотеки и API',
    de: 'Bibliotheken & APIs',
    fr: 'Bibliothèques & API',
    'es-ES': 'Bibliotecas y APIs',
    'ja-JP': 'ライブラリとAPI',
    ko: 'ライ브러리 및 API',
    'pt-BR': 'Bibliotecas e APIs',
    'it-IT': 'Librerie e API',
    pl: 'Biblioteki i API',
  },
  'modCategory.utilities': {
    en: 'UI & Utilities',
    uk: 'Інтерфейс та утиліти',
    'zh-CN': '界面与实用工具',
    'zh-HK': '介面與實用工具',
    'zh-TW': '介面與公用程式',
    ru: 'Интерфейс и утилиты',
    de: 'UI & Dienstprogramme',
    fr: 'Interface & Utilitaires',
    'es-ES': 'Interfaz y Utilidades',
    'ja-JP': 'UIとユーティリティ',
    ko: 'UI 및 유틸리티',
    'pt-BR': 'Interface e Utilitários',
    'it-IT': 'Interfaccia e Utilità',
    pl: 'Interfejs i narzędzia',
  },
  'modCategory.world': {
    en: 'World & Biomes',
    uk: 'Світ та біоми',
    'zh-CN': '世界与生物群系',
    'zh-HK': '世界與生態域',
    'zh-TW': '世界與生態系',
    ru: 'Мир и биомы',
    de: 'Welt & Biome',
    fr: 'Monde & Biomes',
    'es-ES': 'Mundo y Biomas',
    'ja-JP': 'ワールドとバイオーム',
    ko: '월드 및 생물군계',
    'pt-BR': 'Mundo e Biomas',
    'it-IT': 'Mondo e Biomi',
    pl: 'Świat i biomy',
  },
  'modCategory.visual': {
    en: 'Visual & Audio',
    uk: 'Візуал та аудіо',
    'zh-CN': '视觉与音效',
    'zh-HK': '視覺與音效',
    'zh-TW': '視覺與音效',
    ru: 'Визуал и аудио',
    de: 'Grafik & Audio',
    fr: 'Visuel & Audio',
    'es-ES': 'Visual y Audio',
    'ja-JP': 'ビジュアルとオーディオ',
    ko: '비주얼 및 오디오',
    'pt-BR': 'Visual e Áudio',
    'it-IT': 'Grafica e Audio',
    pl: 'Grafika i dźwięk',
  },
  'modCategory.gameplay': {
    en: 'Gameplay & Content',
    uk: 'Геймплей та контент',
    'zh-CN': '玩法与内容',
    'zh-HK': '玩法與內容',
    'zh-TW': '遊戲性與內容',
    ru: 'Геймплей и контент',
    de: 'Gameplay & Inhalte',
    fr: 'Gameplay & Contenu',
    'es-ES': 'Jugabilidad y Contenido',
    'ja-JP': 'ゲームプレイとコンテンツ',
    ko: '게임플레이 및 콘텐츠',
    'pt-BR': 'Jogabilidade e Conteúdo',
    'it-IT': 'Gameplay e Contenuti',
    pl: 'Rozgrywka i zawartość',
  },
  'modCategory.miscellaneous': {
    en: 'Miscellaneous',
    uk: 'Різне',
    'zh-CN': '杂项',
    'zh-HK': '雜項',
    'zh-TW': '其他',
    ru: 'Разное',
    de: 'Verschiedenes',
    fr: 'Divers',
    'es-ES': 'Varios',
    'ja-JP': 'その他',
    ko: '기타',
    'pt-BR': 'Diversos',
    'it-IT': 'Varie',
    pl: 'Różne',
  },
};

export const standardCategoryMap: Record<string, string> = {
  // English
  'Optimization & Performance': 'modCategory.optimization',
  'Libraries & APIs': 'modCategory.libraries',
  'UI & Utilities': 'modCategory.utilities',
  'World & Biomes': 'modCategory.world',
  'Visual & Audio': 'modCategory.visual',
  'Gameplay & Content': 'modCategory.gameplay',
  'Miscellaneous': 'modCategory.miscellaneous',

  // Ukrainian
  'Оптимізація та продуктивність': 'modCategory.optimization',
  'Бібліотеки та API': 'modCategory.libraries',
  'Інтерфейс та утиліти': 'modCategory.utilities',
  'Світ та біоми': 'modCategory.world',
  'Візуал та аудіо': 'modCategory.visual',
  'Геймплей та контент': 'modCategory.gameplay',
  'Різне': 'modCategory.miscellaneous',

  // Chinese (Simplified & Traditional)
  '优化与性能': 'modCategory.optimization',
  '優化與效能': 'modCategory.optimization',
  '最佳化與效能': 'modCategory.optimization',
  '库与 API': 'modCategory.libraries',
  '程式庫與 API': 'modCategory.libraries',
  '界面与实用工具': 'modCategory.utilities',
  '介面與實用工具': 'modCategory.utilities',
  '介面與公用程式': 'modCategory.utilities',
  '世界与生物群系': 'modCategory.world',
  '世界與生態域': 'modCategory.world',
  '世界與生態系': 'modCategory.world',
  '视觉与音效': 'modCategory.visual',
  '視覺與音效': 'modCategory.visual',
  '玩法与内容': 'modCategory.gameplay',
  '玩法與內容': 'modCategory.gameplay',
  '遊戲性與內容': 'modCategory.gameplay',
  '杂项': 'modCategory.miscellaneous',
  '雜項': 'modCategory.miscellaneous',

  // Russian
  'Оптимизация и производительность': 'modCategory.optimization',
  'Библиотеки и API': 'modCategory.libraries',
  'Интерфейс и утилиты': 'modCategory.utilities',
  'Мир и биомы': 'modCategory.world',
  'Визуал и аудио': 'modCategory.visual',
  'Геймплей и контент': 'modCategory.gameplay',
  'Разное': 'modCategory.miscellaneous',

  // Keys
  'modCategory.optimization': 'modCategory.optimization',
  'modCategory.libraries': 'modCategory.libraries',
  'modCategory.utilities': 'modCategory.utilities',
  'modCategory.world': 'modCategory.world',
  'modCategory.visual': 'modCategory.visual',
  'modCategory.gameplay': 'modCategory.gameplay',
  'modCategory.miscellaneous': 'modCategory.miscellaneous',
};

export function getGroupDisplayName(name: string, t: (key: string) => string, currentLocale?: string): string {
  const key = standardCategoryMap[name];
  if (!key) return name;

  const lang = currentLocale || '';
  const dict = categoryTranslations[key];
  if (dict && lang) {
    if (dict[lang]) return dict[lang];
    if (lang === 'zh-HK' || lang === 'zh-TW') {
      return dict['zh-HK'] || dict['zh-TW'] || dict['zh-CN'];
    }
    const prefix = lang.split('-')[0];
    if (dict[prefix]) return dict[prefix];
    if (lang.startsWith('zh')) {
      return dict['zh-CN'] || dict['zh-HK'];
    }
  }

  const translated = t(key);
  if (translated && translated !== key) {
    return translated;
  }

  if (dict?.en) {
    return dict.en;
  }

  return name;
}

export function detectModCategory<T extends GroupableProjectFile = ModFile>(
  entry: ProjectEntry<T>,
  t?: (key: string) => string,
  currentLocale?: string
): { name: string; rawKey: string; color: string; icon: string } {
  const modrinthCategories = entry.modrinth?.categories || [];
  const curseforgeCategories = entry.curseforge?.categories?.map((c: any) => (typeof c === 'string' ? c : c?.name || '')).filter(Boolean) || [];
  const allCategories = [...modrinthCategories.map(c => c.toLowerCase()), ...curseforgeCategories.map(c => c.toLowerCase())];

  const id = (entry.id || '').toLowerCase();
  const title = (entry.title || '').toLowerCase();
  const fileName = (entry.installed?.[0]?.fileName || '').toLowerCase();
  const text = `${id} ${title} ${fileName}`;

  const getName = (key: string, fallback: string) => {
    const lang = currentLocale || '';
    const dict = categoryTranslations[key];
    if (dict && lang) {
      if (dict[lang]) return dict[lang];
      if (lang === 'zh-HK' || lang === 'zh-TW') {
        return dict['zh-HK'] || dict['zh-TW'] || dict['zh-CN'];
      }
      const prefix = lang.split('-')[0];
      if (dict[prefix]) return dict[prefix];
    }
    if (t) {
      const trans = t(key);
      if (trans && trans !== key) return trans;
    }
    return fallback;
  };

  // 1. Performance & Optimization
  if (
    allCategories.some(c => c.includes('optimization') || c.includes('performance')) ||
    /\b(sodium|rubidium|embeddium|iris|oculus|lithium|ferritecore|ferrite-core|modernfix|immediatelyfast|immediately-fast|entityculling|entity-culling|canary|memoryleakfix|krypton|enhancedblockentities|bobby|noisium|chunky|fastfurnace|fastsuite|fastbench|smoothboot|dynamic-fps|dynamicfps|starlight|phosphor|c2me|vmp|dashloader|spark|debugify|lazydfu|clumps)\b/i.test(text)
  ) {
    return {
      rawKey: 'modCategory.optimization',
      name: getName('modCategory.optimization', 'Optimization & Performance'),
      color: '#10B981',
      icon: 'bolt'
    };
  }

  // 2. Libraries & APIs
  if (
    allCategories.some(c => c.includes('library') || c.includes('api')) ||
    /\b(api|lib|library|core|config|fabric-api|fabricloader|cloth-config|cloth_config|architectury|curios|yacl|yetanotherconfiglib|kotlin|fzzy|geckolib|patchouli|owo|cardinal-components|citresewn|indium|balm|collective|bookshelf|puzzleslib|resourceful-lib|cumulus|supermartijn642s-core-lib)\b/i.test(text) ||
    id.endsWith('-lib') || id.endsWith('-api') || id.endsWith('lib')
  ) {
    return {
      rawKey: 'modCategory.libraries',
      name: getName('modCategory.libraries', 'Libraries & APIs'),
      color: '#3B82F6',
      icon: 'extension'
    };
  }

  // 3. UI & Utilities
  if (
    allCategories.some(c => c.includes('utility') || c.includes('gui') || c.includes('management') || c.includes('map')) ||
    /\b(jei|rei|emi|appleskin|jade|wthit|waila|minimap|journeymap|xaero|mousetweaks|controlling|modmenu|mod-menu|inventoryprofiles|inventory-profiles|invmove|shulkerboxtooltip|tooltip|crafting-tweaks|neat|roughlyenoughitems|justenoughitems|zoom|item-borders)\b/i.test(text)
  ) {
    return {
      rawKey: 'modCategory.utilities',
      name: getName('modCategory.utilities', 'UI & Utilities'),
      color: '#06B6D4',
      icon: 'build'
    };
  }

  // 4. World & Biomes
  if (
    allCategories.some(c => c.includes('worldgen') || c.includes('biome') || c.includes('dimension')) ||
    /\b(biome|worldgen|terralith|nullscape|incendium|biomesoplenty|biomes-o-plenty|alexscaves|yung|dungeon|structure|structory|geophilic|towns-and-towers|twilightforest|undergarden|aether|deeperdarker)\b/i.test(text)
  ) {
    return {
      rawKey: 'modCategory.world',
      name: getName('modCategory.world', 'World & Biomes'),
      color: '#8B5CF6',
      icon: 'public'
    };
  }

  // 5. Visual & Audio
  if (
    allCategories.some(c => c.includes('decoration') || c.includes('cosmetic') || c.includes('audio')) ||
    /\b(sound|presencefootsteps|soundphysics|etf|emf|entitytexturefeatures|entitymodelfeatures|waveycapes|skinlayers|3dskinlayers|firstperson|notenoughanimations|visuality|continuity|lambdynamiclights|dynamiclights|fallingleaves|ambientenvironment|physicsmod|voicechat|audioplayer)\b/i.test(text)
  ) {
    return {
      rawKey: 'modCategory.visual',
      name: getName('modCategory.visual', 'Visual & Audio'),
      color: '#EC4899',
      icon: 'palette'
    };
  }

  // 6. Gameplay & Content
  if (
    allCategories.some(c => c.includes('technology') || c.includes('magic') || c.includes('adventure') || c.includes('equipment') || c.includes('food') || c.includes('mobs')) ||
    /\b(create|mekanism|botania|thermal|farmersdelight|farmers-delight|irons_spellbooks|iron-spells|tetra|tinkers|supplementaries|comforts|alexsmobs|alexs-mobs|waystones|quark|apotheosis|enigmaticlegacy|immersiveengineering|refinedstorage|appliedenergistics|ae2)\b/i.test(text)
  ) {
    return {
      rawKey: 'modCategory.gameplay',
      name: getName('modCategory.gameplay', 'Gameplay & Content'),
      color: '#F59E0B',
      icon: 'sports_esports'
    };
  }

  return {
    rawKey: 'modCategory.miscellaneous',
    name: getName('modCategory.miscellaneous', 'Miscellaneous'),
    color: '#6B7280',
    icon: 'folder'
  };
}

