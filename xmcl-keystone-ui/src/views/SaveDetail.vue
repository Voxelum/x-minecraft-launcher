<script setup lang="ts">
import MarketProjectDetail, { ProjectDetail } from '@/components/MarketProjectDetail.vue'
import { ProjectVersion } from '@/components/MarketProjectDetailVersion.vue'
import { useDateString } from '@/composables/date'
import { InstanceSaveFile, kInstanceSave } from '@/composables/instanceSave'
import { injection } from '@/util/inject'
import { ProjectEntry } from '@/util/search'

const props = defineProps<{
  save: ProjectEntry<InstanceSaveFile>
}>()

const emit = defineEmits<{
  (event: 'delete', save: InstanceSaveFile): void
}>()

const { getDateString } = useDateString()
const { t } = useI18n()
const model = computed(() => {
  const v = props.save
  const f = v.files![0]
  const detail: ProjectDetail = {
    id: v.id,
    icon: v.icon,
    title: v.title,
    description: v.description,
    author: v.author,
    downloadCount: 0,
    follows: 0,
    url: '',
    categories: [],
    modLoaders: [],
    htmlContent: '',
    externals: [],
    galleries: [],
    info: [{
      name: t('save.gameMode'),
      value: getLevelMode(f.mode),
      icon: 'shop',
    }, {
      name: t('save.cheat'),
      value: f.cheat + '',
      icon: 'mode',
    }, {
      name: t('save.levelName'),
      value: f.levelName,
      icon: 'badge',
    }, {
      name: t('instance.lastPlayed'),
      value: getDateString(f.lastPlayed),
      icon: 'history',
    }],
  }

  return detail
})

const getLevelMode = (mode: number) => {
  switch (mode) {
    case 0: return t('gameType.survival')
    case 1: return t('gameType.creative')
    case 2: return t('gameType.adventure')
    case 3: return t('gameType.spectator')
    case -1:
    default:
      return 'Non'
  }
}

const versions = computed(() => {
  const v = props.save
  const version: ProjectVersion = {
    id: v.id,
    name: v.title,
    version: '',
    disabled: !!v.disabled,
    installed: true,
    type: 'release',
    downloadCount: 0,
    loaders: [],
  }
  return [version]
})

const onInstall = () => { }
const { enableSave, disableSave } = injection(kInstanceSave)
const onEnable = (enable: boolean) => {
  if (enable) {
    enableSave(props.save.installed[0])
  } else {
    disableSave(props.save.installed[0])
  }
}

</script>
<template>
  <MarketProjectDetail
    :detail="model"
    :dependencies="[]"
    :enabled="!save.disabled"
    :has-installed-version="true"
    :selected-installed="true"
    :loading="false"
    :versions="versions"
    :updating="false"
    :has-more="false"
    :loading-versions="false"
    :no-delete="!!save.installed[0].linkTo"
    no-version
    @install="onInstall"
    @delete="emit('delete', save.installed[0])"
    @enable="onEnable"
  />
</template>
