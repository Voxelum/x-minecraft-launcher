<script setup lang="ts">
import { useDialog } from '@/composables/dialog'
import { kInstance } from '@/composables/instance'
import { analyzeCrashReport, type CrashAnalysisResult } from '@/composables/instanceCrashAnalyze'
import { kInstanceFiles } from '@/composables/instanceFiles'
import { kInstanceJava } from '@/composables/instanceJava'
import { getInstanceJavaIssue } from '@/composables/instanceJavaDiagnose'
import { kInstanceModsContext } from '@/composables/instanceMods'
import { kInstanceVersion } from '@/composables/instanceVersion'
import { kInstanceVersionInstall, type InstanceInstallInstruction } from '@/composables/instanceVersionInstall'
import { kJavaContext } from '@/composables/java'
import { kModDependenciesCheck } from '@/composables/modDependenciesCheck'
import { useNotifier } from '@/composables/notifier'
import { useService } from '@/composables/service'
import { getInstanceIcon } from '@/util/favicon'
import { injection } from '@/util/inject'
import { resolveDepsCompatible } from '@/util/modCompatible'
import {
  InstanceInstallServiceKey,
  InstanceLogServiceKey,
  InstanceServiceKey,
  VersionInstallServiceKey,
} from '@xmcl/runtime-api'

export type RepairCheckId = 'core' | 'libraries' | 'java' | 'files' | 'mods' | 'crash'
export type RepairCheckStatus = 'pending' | 'checking' | 'healthy' | 'warning' | 'repairing' | 'repaired' | 'error'

export interface RepairCheckItem {
  id: RepairCheckId
  icon: string
  status: RepairCheckStatus
  issueCount: number
  summary: string
  details: string[]
  selected: boolean
  autoFixable: boolean
}

const CHECK_ORDER: RepairCheckId[] = ['core', 'libraries', 'java', 'files', 'mods', 'crash']

const CHECK_WEIGHTS: Record<RepairCheckId, number> = {
  core: 25,
  libraries: 20,
  java: 20,
  files: 15,
  mods: 15,
  crash: 5,
}

const CHECK_ICONS: Record<RepairCheckId, string> = {
  core: 'view_in_ar',
  libraries: 'library_books',
  java: 'coffee',
  files: 'folder_zip',
  mods: 'extension',
  crash: 'bug_report',
}

const STATUS_ICONS: Partial<Record<RepairCheckStatus, { icon: string; color: string }>> = {
  healthy: { icon: 'check_circle', color: 'success' },
  repaired: { icon: 'check_circle', color: 'success' },
  warning: { icon: 'warning_amber', color: 'warning' },
  error: { icon: 'error_outline', color: 'error' },
}

const RUNTIME_BADGE_DEFS = [
  { key: 'minecraft', prefix: 'Minecraft', icon: 'xmcl:minecraft' },
  { key: 'neoForged', prefix: 'NeoForge', icon: 'xmcl:neoForged' },
  { key: 'forge', prefix: 'Forge', icon: 'xmcl:forge' },
  { key: 'fabricLoader', prefix: 'Fabric', icon: 'xmcl:fabric' },
  { key: 'quiltLoader', prefix: 'Quilt', icon: 'xmcl:quilt' },
  { key: 'optifine', prefix: 'OptiFine', icon: 'xmcl:optifine' },
] as const

const { path: currentInstancePath, instance } = injection(kInstance)
const { resolvedVersion, refreshResolvedVersion } = injection(kInstanceVersion)
const {
  instruction,
  fix: fixInstanceVersion,
  getInstallInstruction,
  handleInstallInstruction,
  getInstanceLock,
} = injection(kInstanceVersionInstall)
const { unresolvedFiles, resumeInstall } = injection(kInstanceFiles)
const { status: javaStatus, getInstanceJavaStatus } = injection(kInstanceJava)
const { all: javaList, refresh: refreshJavaList } = injection(kJavaContext)
const instanceMods = injection(kInstanceModsContext)
const dependencyCheck = injection(kModDependenciesCheck)

const versionInstallService = useService(VersionInstallServiceKey)
const instanceInstallService = useService(InstanceInstallServiceKey)
const instanceService = useService(InstanceServiceKey)
const logService = useService(InstanceLogServiceKey)
const { notify } = useNotifier()
const { t } = useI18n()

const checkTitles = computed<Record<RepairCheckId, string>>(() => ({
  core: t('instanceRepair.checkCore'),
  libraries: t('instanceRepair.checkLibraries'),
  java: t('instanceRepair.checkJava'),
  files: t('instanceRepair.checkFiles'),
  mods: t('instanceRepair.checkMods'),
  crash: t('instanceRepair.checkCrash'),
}))

const scanning = ref(false)
const repairing = ref(false)
const deepReinstall = ref(false)
const repairCompleted = ref(false)
const lastRepairCount = ref(0)
const showLog = ref(false)
const copiedReport = ref(false)
const activityLog = ref<string[]>([])
const lastCrashAnalysis = shallowRef<CrashAnalysisResult | undefined>(undefined)

function createCheckItem(id: RepairCheckId): RepairCheckItem {
  return {
    id,
    icon: CHECK_ICONS[id],
    status: 'pending',
    issueCount: 0,
    summary: '',
    details: [],
    selected: true,
    autoFixable: true,
  }
}

function createInitialChecks(): Record<RepairCheckId, RepairCheckItem> {
  return {
    core: createCheckItem('core'),
    libraries: createCheckItem('libraries'),
    java: createCheckItem('java'),
    files: createCheckItem('files'),
    mods: createCheckItem('mods'),
    crash: createCheckItem('crash'),
  }
}

const checks = ref<Record<RepairCheckId, RepairCheckItem>>(createInitialChecks())

const checkList = computed(() => CHECK_ORDER.map(id => checks.value[id]))

const totalIssues = computed(() =>
  checkList.value.reduce((acc, item) => acc + item.issueCount, 0),
)

const selectedIssueCount = computed(() =>
  checkList.value
    .filter(item => item.selected && item.autoFixable)
    .reduce((acc, item) => acc + item.issueCount, 0),
)

const healthScore = computed(() => {
  if (scanning.value) return 0
  const penalty = checkList.value
    .filter(item => item.issueCount > 0 || item.status === 'error')
    .reduce((acc, item) => acc + CHECK_WEIGHTS[item.id], 0)
  return Math.max(0, 100 - penalty)
})

const healthColor = computed(() => {
  if (scanning.value || repairing.value) return 'primary'
  if (healthScore.value >= 95) return 'success'
  return healthScore.value >= 60 ? 'warning' : 'error'
})

const runtimeBadges = computed(() => {
  const rt = instance.value?.runtime
  return RUNTIME_BADGE_DEFS
    .filter(def => Boolean(rt?.[def.key]))
    .map(def => ({
      label: `${def.prefix} ${rt?.[def.key]}`,
      icon: def.icon,
    }))
})

const headerChipState = computed(() => {
  if (scanning.value) return { color: 'primary', text: t('instanceRepair.statusScanning') }
  if (repairing.value) return { color: 'primary', text: t('instanceRepair.statusRepairing') }
  return totalIssues.value > 0
    ? { color: 'warning', text: t('instanceRepair.statusIssues', { count: totalIssues.value }) }
    : { color: 'success', text: t('instanceRepair.statusHealthy') }
})

function pushLog(message: string) {
  const stamp = new Date().toLocaleTimeString([], { hour12: false })
  activityLog.value = [...activityLog.value, `[${stamp}] ${message}`]
}

function setCheckResult(
  id: RepairCheckId,
  issueCount: number,
  details: string[],
  healthySummary: string,
  warningSummary: string,
  postRepair: boolean,
  autoFixable = true,
) {
  const target = checks.value[id]
  target.issueCount = issueCount
  target.details = details
  target.autoFixable = autoFixable
  target.selected = issueCount > 0 && autoFixable
  target.status = issueCount > 0 ? 'warning' : (postRepair ? 'repaired' : 'healthy')
  target.summary = issueCount > 0 ? warningSummary : healthySummary
}

function collectCoreIssues(instInstruction: InstanceInstallInstruction, mcVersion: string): string[] {
  return [
    !instInstruction.resolvedVersion ? t('instanceRepair.issueUnresolvedVersion', { version: mcVersion }) : '',
    instInstruction.jar ? t('instanceRepair.issueCorruptedVersionJar', { version: instInstruction.jar }) : '',
    instInstruction.forge ? `Forge ${instInstruction.forge.version}` : '',
    instInstruction.optifine ? `OptiFine ${instInstruction.optifine}` : '',
    instInstruction.profile ? `Profile ${instInstruction.profile.version}` : '',
  ].filter(Boolean)
}

function hasMemoryConfigIssue(): boolean {
  const inst = instance.value
  const minMem = inst.minMemory ?? 0
  const maxMem = inst.maxMemory ?? 0
  return Boolean(
    (minMem > 0 && maxMem > 0 && minMem > maxMem) ||
    (inst.assignMemory === true && maxMem > 0 && maxMem < 1024),
  )
}

const { isShown } = useDialog<string | undefined>('instance-repair', async (targetPath) => {
  repairCompleted.value = false
  lastRepairCount.value = 0
  activityLog.value = []
  showLog.value = false
  copiedReport.value = false
  if (targetPath && targetPath !== currentInstancePath.value) {
    currentInstancePath.value = targetPath
    await nextTick()
    await new Promise(resolve => setTimeout(resolve, 150))
  }
  await runDiagnostics()
})

async function runDiagnostics(postRepair = false) {
  if (scanning.value || repairing.value) return
  const inst = instance.value
  if (!inst?.path) return

  scanning.value = true
  repairCompleted.value = postRepair ? repairCompleted.value : false
  pushLog(t('instanceRepair.logScanStarted'))

  CHECK_ORDER.forEach((id) => {
    checks.value[id].status = 'checking'
    checks.value[id].issueCount = 0
    checks.value[id].details = []
    checks.value[id].summary = t('instanceRepair.checking')
  })

  try {
    await Promise.resolve(refreshResolvedVersion()).catch(() => undefined)
    const ver = resolvedVersion.value
    const resolved = ver && 'id' in ver ? ver : undefined
    const instInstruction = await getInstallInstruction(
      inst.path,
      inst.runtime,
      inst.version,
      resolved,
      javaList.value,
    )
    instruction.value = instInstruction

    const coreIssues = collectCoreIssues(instInstruction, inst.runtime.minecraft)
    setCheckResult(
      'core',
      coreIssues.length,
      coreIssues,
      t('instanceRepair.coreHealthy', { version: instInstruction.resolvedVersion || inst.runtime.minecraft }),
      t('instanceRepair.coreIssuesFound', { count: coreIssues.length }),
      postRepair,
    )

    const libCount = instInstruction.libraries?.length ?? 0
    const assetCount = (instInstruction.assets?.length ?? 0) + (instInstruction.assetsIndex ? 1 : 0)
    const libDetails = [
      libCount > 0 ? t('instanceRepair.issueLibrariesCount', { count: libCount }) : '',
      ...(instInstruction.libraries || []).slice(0, 4).map(lib => lib.name),
      assetCount > 0 ? t('instanceRepair.issueAssetsCount', { count: assetCount }) : '',
    ].filter(Boolean)

    setCheckResult(
      'libraries',
      libCount + assetCount,
      libDetails,
      t('instanceRepair.librariesHealthy'),
      t('instanceRepair.librariesIssuesFound', { libs: libCount, assets: assetCount }),
      postRepair,
    )

    const javaStat = await getInstanceJavaStatus(ver, inst).catch(() => javaStatus.value)
    const hasJavaIssue = Boolean(getInstanceJavaIssue(javaStat) || instInstruction.java)
    const memIssue = hasMemoryConfigIssue()
    const reqMajor = javaStat?.javaVersion?.majorVersion || instInstruction.java?.majorVersion || 17
    const javaDetails = [
      hasJavaIssue ? t('instanceRepair.issueJavaRequired', { major: reqMajor }) : '',
      memIssue ? t('instanceRepair.issueMemoryConfig') : '',
    ].filter(Boolean)

    setCheckResult(
      'java',
      javaDetails.length,
      javaDetails,
      t('instanceRepair.javaHealthy', { version: javaStat?.java?.version || 'Auto' }),
      t('instanceRepair.javaIssuesFound', { major: reqMajor }),
      postRepair,
    )

    const pendingFiles = unresolvedFiles.value ?? []
    setCheckResult(
      'files',
      pendingFiles.length,
      pendingFiles.slice(0, 5).map(f => f.path),
      t('instanceRepair.filesHealthy'),
      t('instanceRepair.filesIssuesFound', { count: pendingFiles.length }),
      postRepair,
    )

    await dependencyCheck.refresh().catch(() => undefined)
    const missingDeps = dependencyCheck.installation.value ?? []
    const duplicateGroups = Object.entries(instanceMods.conflicted.value ?? {})
    const loaderIncompat = instanceMods.loaderIncompatibilities.value ?? []
    const incompatibleModIds = Object.entries(instanceMods.compatibility.value ?? {})
      .filter(([, details]) => !resolveDepsCompatible(details))
      .map(([modId]) => modId)

    const modDetails = [
      ...missingDeps.slice(0, 4).map(([depFile, parentMod]) =>
        `${t('instanceRepair.missingDepLabel')}: ${depFile.path.replace(/^\/?mods\//, '')} (${parentMod.name || parentMod.fileName})`,
      ),
      ...duplicateGroups.slice(0, 4).map(([modId, dupList]) =>
        `${t('instanceRepair.duplicateModLabel')}: ${modId} (${dupList.length}x)`,
      ),
      ...loaderIncompat.slice(0, 4).map(inc =>
        `${t('instanceRepair.incompatibleModLabel')}: ${inc.file} (${inc.supportedLoaders.join(', ')})`,
      ),
      ...incompatibleModIds.slice(0, 3).map(modId =>
        `${t('instanceRepair.versionConflictLabel')}: ${modId}`,
      ),
    ]

    const totalModIssues = missingDeps.length + duplicateGroups.length + loaderIncompat.length + incompatibleModIds.length
    const autoFixableMods = missingDeps.length + duplicateGroups.length + loaderIncompat.length > 0
    setCheckResult(
      'mods',
      totalModIssues,
      modDetails,
      t('instanceRepair.modsHealthy', { count: instanceMods.enabledMods.value.length }),
      t('instanceRepair.modsIssuesFound', {
        deps: missingDeps.length,
        conflicts: duplicateGroups.length + loaderIncompat.length + incompatibleModIds.length,
      }),
      postRepair,
      autoFixableMods,
    )

    const crashFiles = await logService.listCrashReports(inst.path).catch(() => [] as string[])
    const latestCrashFile = [...crashFiles].sort().at(-1)
    const crashContent = latestCrashFile
      ? await logService.getCrashReportContent(inst.path, latestCrashFile).catch(() => '')
      : ''
    const analysis = latestCrashFile && crashContent
      ? analyzeCrashReport(latestCrashFile, crashContent)
      : undefined
    lastCrashAnalysis.value = analysis

    const crashDetails = analysis?.details ?? []
    const crashCount = crashDetails.length
    setCheckResult(
      'crash',
      crashCount,
      latestCrashFile && crashCount > 0 ? [latestCrashFile, ...crashDetails] : crashDetails,
      t('instanceRepair.crashHealthy'),
      t('instanceRepair.crashIssuesFound', { count: crashCount }),
      postRepair,
      Boolean(analysis?.needsMoreMemory),
    )

    pushLog(t('instanceRepair.logScanFinished', { count: totalIssues.value }))
  } finally {
    scanning.value = false
  }
}

async function executeStep(ids: RepairCheckId[], task: () => Promise<number>): Promise<number> {
  ids.forEach((id) => {
    checks.value[id].status = 'repairing'
    checks.value[id].summary = t('instanceRepair.repairingStep')
  })
  try {
    const fixed = await task()
    ids.forEach((id) => {
      checks.value[id].status = 'repaired'
    })
    pushLog(t('instanceRepair.logStepDone', { step: ids.map(id => checkTitles.value[id]).join(', '), count: fixed }))
    return fixed
  } catch (e) {
    console.error('[instance-repair]', e)
    ids.forEach((id) => {
      checks.value[id].status = 'error'
    })
    pushLog(t('instanceRepair.logStepFailed', { step: ids.map(id => checkTitles.value[id]).join(', ') }))
    return 0
  }
}

async function repairJavaStep(instPath: string): Promise<number> {
  const inst = instance.value
  const javaStat = await getInstanceJavaStatus(resolvedVersion.value, inst).catch(() => javaStatus.value)
  let fixed = 0

  if (hasMemoryConfigIssue()) {
    const safeMax = Math.max(inst.maxMemory || 0, inst.minMemory || 0, 2048)
    const safeMin = inst.minMemory && inst.minMemory > safeMax ? Math.min(1024, safeMax) : inst.minMemory
    await instanceService.editInstance({
      instancePath: instPath,
      maxMemory: safeMax,
      ...(safeMin !== undefined ? { minMemory: safeMin } : {}),
    })
    fixed += 1
  }

  if (inst.java && javaStat?.preferredJava?.valid) {
    await instanceService.editInstance({ instancePath: instPath, java: '' })
    return Math.max(fixed, checks.value.java.issueCount)
  }

  const targetJava = javaStat?.javaVersion || instruction.value?.java
  if (targetJava && (getInstanceJavaIssue(javaStat) || instruction.value?.java)) {
    await versionInstallService.install({ type: 'java', target: targetJava, forceZulu: false })
    await refreshJavaList(true).catch(() => undefined)
    fixed += 1
  }
  return Math.max(fixed, 1)
}

async function repairCoreAndLibrariesStep(instPath: string): Promise<number> {
  const inst = instance.value
  const lock = getInstanceLock(instPath)
  await lock.runExclusive(async () => {
    const shouldReinstall = deepReinstall.value || !instruction.value?.resolvedVersion
    if (shouldReinstall) {
      const installedVer = await versionInstallService.install({
        type: 'instance',
        instancePath: instPath,
        runtime: inst.runtime,
        selectedVersion: inst.version,
      })
      if (installedVer.version && installedVer.version !== inst.version) {
        await instanceService.editInstance({ instancePath: instPath, version: installedVer.version })
      }
      await Promise.resolve(refreshResolvedVersion()).catch(() => undefined)
      return
    }
    if (instruction.value) {
      await handleInstallInstruction(instruction.value)
    }
  })
  await fixInstanceVersion(instPath).catch(() => undefined)
  return Math.max(1, checks.value.core.issueCount + checks.value.libraries.issueCount)
}

async function repairModsStep(instPath: string): Promise<number> {
  let fixed = 0
  const missingDeps = dependencyCheck.installation.value ?? []
  if (missingDeps.length > 0) {
    const depFiles = missingDeps.map(([file]) => file)
    const opId = crypto.getRandomValues(new Uint32Array(2)).join('')
    await instanceInstallService.stageInstanceFiles({
      path: instPath,
      oldFiles: [],
      files: depFiles,
      id: opId,
    })
    await resumeInstall(instPath)
    await instanceMods.revalidateAndWait().catch(() => undefined)
    fixed += missingDeps.length
  }

  const duplicatePaths = Object.values(instanceMods.conflicted.value ?? {})
    .filter(dupMods => dupMods.length > 1)
    .flatMap(dupMods =>
      [...dupMods]
        .sort((a, b) => b.version.localeCompare(a.version, undefined, { numeric: true }))
        .slice(1)
        .map(m => m.path),
    )

  const incompatibleNames = new Set((instanceMods.loaderIncompatibilities.value ?? []).map(inc => inc.file))
  const incompatiblePaths = instanceMods.mods.value
    .filter(m => m.enabled && incompatibleNames.has(m.fileName))
    .map(m => m.path)

  const filesToDisable = Array.from(new Set([...duplicatePaths, ...incompatiblePaths]))
  if (filesToDisable.length > 0) {
    await instanceMods.disable({ path: instPath, files: filesToDisable })
    await instanceMods.revalidate().catch(() => undefined)
    fixed += filesToDisable.length
  }
  return fixed
}

async function repairCrashMemoryStep(instPath: string): Promise<number> {
  if (!lastCrashAnalysis.value?.needsMoreMemory) return 0
  const currentMax = instance.value.maxMemory || 2048
  const boostedMax = Math.min(8192, Math.max(4096, currentMax + 2048))
  await instanceService.editInstance({
    instancePath: instPath,
    assignMemory: true,
    maxMemory: boostedMax,
  })
  pushLog(t('instanceRepair.logMemoryBoosted', { memory: boostedMax }))
  return 1
}

const STEP_RUNNERS: Record<RepairCheckId, (instPath: string) => Promise<number>> = {
  java: repairJavaStep,
  core: repairCoreAndLibrariesStep,
  libraries: repairCoreAndLibrariesStep,
  files: async (instPath) => {
    const count = checks.value.files.issueCount
    await resumeInstall(instPath)
    return count
  },
  mods: repairModsStep,
  crash: repairCrashMemoryStep,
}

async function repairSingleCategory(id: RepairCheckId) {
  if (repairing.value || scanning.value) return
  const inst = instance.value
  if (!inst?.path) return
  repairing.value = true
  try {
    const fixed = await executeStep([id], () => STEP_RUNNERS[id](inst.path))
    lastRepairCount.value = fixed
    repairCompleted.value = true
  } finally {
    repairing.value = false
  }
  await runDiagnostics(true)
}

async function runAutoRepair() {
  if (repairing.value || scanning.value) return
  const inst = instance.value
  if (!inst?.path) return

  repairing.value = true
  repairCompleted.value = false
  let fixedItemsCount = 0
  const instPath = inst.path

  try {
    if (checks.value.java.selected && checks.value.java.issueCount > 0) {
      fixedItemsCount += await executeStep(['java'], () => repairJavaStep(instPath))
    }

    const coreLibTargets = (['core', 'libraries'] as const).filter(
      id => (checks.value[id].selected && checks.value[id].issueCount > 0) || deepReinstall.value,
    )
    if (coreLibTargets.length > 0) {
      fixedItemsCount += await executeStep(coreLibTargets, () => repairCoreAndLibrariesStep(instPath))
    }

    if (checks.value.files.selected && checks.value.files.issueCount > 0) {
      fixedItemsCount += await executeStep(['files'], () => STEP_RUNNERS.files(instPath))
    }

    if (checks.value.mods.selected && checks.value.mods.issueCount > 0) {
      fixedItemsCount += await executeStep(['mods'], () => repairModsStep(instPath))
    }

    if (checks.value.crash.selected && checks.value.crash.autoFixable && checks.value.crash.issueCount > 0) {
      fixedItemsCount += await executeStep(['crash'], () => repairCrashMemoryStep(instPath))
    }

    lastRepairCount.value = fixedItemsCount
    repairCompleted.value = true
  } finally {
    repairing.value = false
  }

  await runDiagnostics(true)

  notify({
    level: totalIssues.value === 0 ? 'success' : 'warning',
    title: t('instanceRepair.title'),
    body: totalIssues.value === 0
      ? t('instanceRepair.repairSuccessNotify', { name: inst.name || `Minecraft ${inst.runtime.minecraft}` })
      : t('instanceRepair.repairPartialNotify', { remaining: totalIssues.value }),
  })
}

async function copyDiagnosticReport() {
  const inst = instance.value
  const lines = [
    `# XMCL Build Repair Report`,
    `- Instance: ${inst?.name || 'Unknown'}`,
    `- Runtime: ${runtimeBadges.value.map(b => b.label).join(', ')}`,
    `- Health Score: ${healthScore.value}% (${totalIssues.value} issue(s))`,
    '',
    ...checkList.value.map(item => [
      `## ${checkTitles.value[item.id]} [${item.status.toUpperCase()}]`,
      item.summary,
      ...item.details.map(d => `  - ${d}`),
    ].join('\n')),
    ...(activityLog.value.length > 0 ? ['', '## Repair Log', ...activityLog.value] : []),
  ]
  await navigator.clipboard.writeText(lines.join('\n')).catch(() => undefined)
  copiedReport.value = true
  setTimeout(() => {
    copiedReport.value = false
  }, 2000)
}
</script>

<template>
  <v-dialog
    v-model="isShown"
    width="860"
    :persistent="repairing"
  >
    <v-card class="flex flex-col overflow-hidden">
      <v-toolbar color="transparent" density="comfortable" class="px-2 select-none">
        <v-icon color="primary" class="ml-2 mr-3">build_circle</v-icon>
        <v-toolbar-title class="text-subtitle-1 font-weight-bold">
          {{ t('instanceRepair.title') }}
        </v-toolbar-title>
        <v-spacer />
        <v-btn
          variant="text"
          size="small"
          :prepend-icon="copiedReport ? 'check' : 'content_copy'"
          :color="copiedReport ? 'success' : undefined"
          :disabled="scanning"
          @click="copyDiagnosticReport"
        >
          {{ copiedReport ? t('shared.copied') : t('instanceRepair.copyReport') }}
        </v-btn>
        <v-btn
          icon="close"
          variant="text"
          size="small"
          :disabled="repairing"
          :aria-label="t('shared.close')"
          @click="isShown = false"
        />
      </v-toolbar>

      <v-progress-linear
        v-if="scanning || repairing"
        indeterminate
        color="primary"
        height="2"
      />
      <v-divider v-else />

      <v-card-text class="pa-5 overflow-y-auto max-h-[75vh] visible-scroll">
        <div class="grid grid-cols-1 md:grid-cols-12 gap-4 items-stretch">
          <div class="md:col-span-4 flex flex-col justify-between gap-3">
            <div class="surface-panel pa-5 flex flex-col items-center text-center">
              <v-progress-circular
                :model-value="scanning ? 0 : healthScore"
                :indeterminate="scanning || repairing"
                :color="healthColor"
                :size="96"
                :width="6"
                bg-color="rgba(var(--v-theme-on-surface), 0.1)"
              >
                <div class="flex flex-col items-center justify-center">
                  <img
                    v-if="instance"
                    :src="getInstanceIcon(instance, undefined)"
                    alt=""
                    class="w-9 h-9 object-contain rounded mb-0.5"
                  >
                  <span class="text-caption font-mono font-weight-bold">
                    {{ scanning ? '...' : `${healthScore}%` }}
                  </span>
                </div>
              </v-progress-circular>

              <div class="text-subtitle-2 font-weight-bold truncate w-full mt-3">
                {{ instance?.name || `Minecraft ${instance?.runtime?.minecraft || ''}` }}
              </div>

              <v-chip
                size="small"
                :color="headerChipState.color"
                variant="tonal"
                label
                class="mt-2 font-weight-medium"
              >
                {{ headerChipState.text }}
              </v-chip>

              <div v-if="runtimeBadges.length > 0" class="flex flex-wrap items-center justify-center gap-1.5 mt-4">
                <v-chip
                  v-for="badge in runtimeBadges"
                  :key="badge.label"
                  size="x-small"
                  variant="tonal"
                  label
                >
                  <v-icon start size="14">{{ badge.icon }}</v-icon>
                  {{ badge.label }}
                </v-chip>
              </div>
            </div>

            <div class="flex flex-col gap-2">
              <div
                class="surface-card-row pa-3 flex items-center justify-between gap-2 cursor-pointer"
                :class="{ 'repair-row--active': deepReinstall }"
                role="button"
                tabindex="0"
                :aria-pressed="deepReinstall"
                @click="deepReinstall = !deepReinstall"
                @keydown.enter.prevent="deepReinstall = !deepReinstall"
                @keydown.space.prevent="deepReinstall = !deepReinstall"
              >
                <div class="min-w-0">
                  <div class="text-caption font-weight-bold flex items-center gap-1.5">
                    <v-icon :color="deepReinstall ? 'primary' : undefined" size="16">published_with_changes</v-icon>
                    <span class="truncate">{{ t('instanceRepair.deepReinstallTitle') }}</span>
                  </div>
                  <div class="repair-muted text-[11px] mt-0.5 line-clamp-2 leading-snug">
                    {{ t('instanceRepair.deepReinstallDesc') }}
                  </div>
                </div>
                <v-switch
                  v-model="deepReinstall"
                  color="primary"
                  density="compact"
                  hide-details
                  class="shrink-0"
                  @click.stop
                />
              </div>

              <v-btn
                v-if="activityLog.length > 0"
                variant="tonal"
                block
                size="small"
                :prepend-icon="'terminal'"
                :append-icon="showLog ? 'expand_less' : 'expand_more'"
                :aria-expanded="showLog"
                @click="showLog = !showLog"
              >
                {{ t('instanceRepair.activityLog') }} ({{ activityLog.length }})
              </v-btn>
            </div>
          </div>

          <div class="md:col-span-8 flex flex-col gap-3">
            <v-alert
              v-if="repairCompleted && !scanning && !repairing"
              :type="totalIssues === 0 ? 'success' : 'warning'"
              variant="tonal"
              density="compact"
              class="text-caption"
            >
              {{
                totalIssues === 0
                  ? t('instanceRepair.bannerSuccess', { count: lastRepairCount })
                  : t('instanceRepair.bannerPartial', { remaining: totalIssues })
              }}
            </v-alert>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3" role="list" :aria-label="t('instanceRepair.title')">
              <div
                v-for="item in checkList"
                :key="item.id"
                role="listitem"
                :data-testid="`repair-check-${item.id}`"
                class="surface-card-row pa-3.5 flex flex-col justify-between gap-2.5"
                :class="{ 'repair-row--warning': item.issueCount > 0 }"
              >
                <div class="flex items-start justify-between gap-2">
                  <div class="flex items-start gap-2.5 min-w-0">
                    <v-checkbox-btn
                      v-if="item.issueCount > 0 && item.autoFixable"
                      v-model="item.selected"
                      color="warning"
                      density="compact"
                      :disabled="repairing || scanning"
                      class="shrink-0 -ml-1"
                    />
                    <v-avatar
                      size="34"
                      rounded="lg"
                      :color="item.issueCount > 0 ? 'warning' : 'primary'"
                      variant="tonal"
                      class="shrink-0"
                    >
                      <v-progress-circular
                        v-if="item.status === 'checking' || item.status === 'repairing'"
                        indeterminate
                        size="18"
                        width="2"
                        color="primary"
                      />
                      <v-icon v-else size="18">{{ item.icon }}</v-icon>
                    </v-avatar>
                    <div class="min-w-0">
                      <div class="text-body-2 font-weight-bold leading-tight truncate">
                        {{ checkTitles[item.id] }}
                      </div>
                      <div class="repair-muted text-caption mt-0.5 line-clamp-2 leading-snug">
                        {{ item.summary }}
                      </div>
                    </div>
                  </div>

                  <div class="shrink-0 flex items-center">
                    <v-chip
                      v-if="item.issueCount > 0"
                      size="x-small"
                      color="warning"
                      variant="flat"
                      label
                      class="font-weight-bold"
                    >
                      {{ item.issueCount }}
                    </v-chip>
                    <v-icon
                      v-else-if="STATUS_ICONS[item.status]"
                      :color="STATUS_ICONS[item.status]?.color"
                      size="19"
                    >
                      {{ STATUS_ICONS[item.status]?.icon }}
                    </v-icon>
                  </div>
                </div>

                <div
                  v-if="item.details.length > 0 || (item.issueCount > 0 && item.autoFixable && !scanning && !repairing)"
                  class="repair-details flex flex-col gap-2 pt-2"
                >
                  <div v-if="item.details.length > 0" class="flex flex-wrap gap-1">
                    <v-chip
                      v-for="(detail, idx) in item.details.slice(0, 3)"
                      :key="idx"
                      size="x-small"
                      variant="outlined"
                      label
                      class="font-mono max-w-full"
                    >
                      <span class="truncate">{{ detail }}</span>
                    </v-chip>
                  </div>
                  <div v-if="item.issueCount > 0 && item.autoFixable && !scanning && !repairing" class="flex justify-end">
                    <v-btn
                      size="x-small"
                      color="warning"
                      variant="tonal"
                      prepend-icon="build"
                      @click="repairSingleCategory(item.id)"
                    >
                      {{ t('instanceRepair.fixSingle') }}
                    </v-btn>
                  </div>
                </div>
              </div>
            </div>

            <v-expand-transition>
              <div
                v-if="showLog && activityLog.length > 0"
                class="surface-panel pa-3 max-h-32 overflow-y-auto visible-scroll font-mono text-[11px] space-y-1 repair-muted"
              >
                <div v-for="(entry, idx) in activityLog" :key="idx">
                  {{ entry }}
                </div>
              </div>
            </v-expand-transition>
          </div>
        </div>
      </v-card-text>

      <v-divider />

      <v-card-actions class="px-5 py-3">
        <v-btn
          variant="text"
          prepend-icon="refresh"
          :loading="scanning"
          :disabled="repairing"
          data-testid="instance-repair-rescan"
          @click="runDiagnostics(false)"
        >
          {{ t('instanceRepair.rescan') }}
        </v-btn>
        <v-spacer />
        <v-btn
          variant="text"
          :disabled="repairing"
          @click="isShown = false"
        >
          {{ t('shared.close') }}
        </v-btn>
        <v-btn
          color="primary"
          variant="flat"
          prepend-icon="build"
          :loading="repairing"
          :disabled="scanning || (selectedIssueCount === 0 && !deepReinstall)"
          data-testid="instance-repair-run"
          @click="runAutoRepair"
        >
          {{
            selectedIssueCount > 0
              ? t('instanceRepair.repairNow', { count: selectedIssueCount })
              : t('instanceRepair.forceRepair')
          }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.repair-muted {
  color: rgba(var(--v-theme-on-surface), 0.68);
}

.repair-row--warning {
  border-color: rgba(var(--v-theme-warning), 0.45) !important;
  background-color: rgba(var(--v-theme-warning), 0.06) !important;
}

.repair-row--active {
  border-color: rgba(var(--v-theme-primary), 0.5) !important;
  background-color: rgba(var(--v-theme-primary), 0.08) !important;
}

.repair-details {
  border-top: 1px solid rgba(var(--v-theme-on-surface), 0.08);
}
</style>
