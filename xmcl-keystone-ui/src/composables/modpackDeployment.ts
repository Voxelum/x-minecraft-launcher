import type {
  DeploymentPreview,
  ModpackApiError,
  ModpackAsyncTask,
  ModpackDeployment,
  ModpackDeploymentService,
  ModpackSourceFormat,
  ModpackValidationReport,
  SelectedModpackPackage,
} from '@xmcl/runtime-api/src/services/ModpackDeploymentService'
import { DeploymentPreviewSchema, ModpackDeploymentApiException } from '@xmcl/runtime-api/src/services/ModpackDeploymentService'
import { computed, ref, shallowRef, toValue, type MaybeRefOrGetter } from 'vue'

export type ModpackDeploymentPhase =
  | 'empty'
  | 'selected'
  | 'uploading'
  | 'validating'
  | 'report'
  | 'preparing-preview'
  | 'preview'
  | 'applying'
  | 'applied'
  | 'rolling-back'
  | 'rolled-back'
  | 'conflict'
  | 'error'

export interface ModpackDeploymentClientError {
  code: string
  message: string
  requestId?: string
  retryable: boolean
  category: 'auth' | 'provider' | 'worker' | 'conflict' | 'validation' | 'network' | 'unknown'
  details?: unknown
}

export interface UseModpackDeploymentOptions {
  serverId: MaybeRefOrGetter<string>
  pollIntervalMs?: number
  maxPollAttempts?: number
  sleep?: (milliseconds: number) => Promise<void>
  createIdempotencyKey?: (operation: string) => string
}

const terminalTaskStatuses = new Set(['succeeded', 'failed', 'cancelled'])

export function useModpackDeployment(
  service: ModpackDeploymentService,
  options: UseModpackDeploymentOptions,
) {
  const phase = ref<ModpackDeploymentPhase>('empty')
  const selectedPackage = shallowRef<SelectedModpackPackage>()
  const sourceFormat = ref<ModpackSourceFormat>()
  const importId = ref<string>()
  const deploymentId = ref<string>()
  const report = shallowRef<ModpackValidationReport>()
  const preview = shallowRef<DeploymentPreview>()
  const deployment = shallowRef<ModpackDeployment>()
  const history = shallowRef<ModpackDeployment[]>([])
  const currentTask = shallowRef<ModpackAsyncTask>()
  const error = shallowRef<ModpackDeploymentClientError>()
  const reportConfirmed = ref(false)
  const previewConfirmed = ref(false)
  const busy = computed(() => [
    'uploading',
    'validating',
    'preparing-preview',
    'applying',
    'rolling-back',
  ].includes(phase.value))
  const canPreparePreview = computed(() =>
    report.value?.status === 'valid' &&
    report.value.rejectedFiles.length === 0 &&
    reportConfirmed.value &&
    !busy.value,
  )
  const canApply = computed(() =>
    report.value?.status === 'valid' &&
    report.value.rejectedFiles.length === 0 &&
    !!preview.value &&
    preview.value.statusVersion === deployment.value?.statusVersion &&
    reportConfirmed.value &&
    previewConfirmed.value &&
    !busy.value,
  )
  const canRollback = computed(() =>
    !!deployment.value &&
    ['applied', 'error', 'conflict'].includes(phase.value) &&
    !busy.value,
  )

  const sleep = options.sleep ?? (milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds)))
  const pollIntervalMs = options.pollIntervalMs ?? 1_000
  const maxPollAttempts = options.maxPollAttempts ?? 120
  const makeKey = options.createIdempotencyKey ??
    (operation => `${operation}-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`}`)
  const idempotencyKeys = new Map<string, string>()
  let lastOperation: (() => Promise<void>) | undefined

  function selectPackage(file: SelectedModpackPackage) {
    const lowerName = file.name.toLowerCase()
    const format = lowerName.endsWith('.mrpack')
      ? 'mrpack'
      : lowerName.endsWith('.zip')
        ? 'curseforge_zip'
        : undefined
    if (!format) {
      selectedPackage.value = undefined
      sourceFormat.value = undefined
      resetRemoteState()
      throw setClientError({
        code: 'unsupported_package',
        message: 'Select a .mrpack or CurseForge .zip package',
        retryable: false,
        category: 'validation',
      })
    }
    if (file.size <= 0 || file.body.size !== file.size) {
      selectedPackage.value = undefined
      sourceFormat.value = undefined
      resetRemoteState()
      throw setClientError({
        code: 'invalid_package_size',
        message: 'The selected package is empty or changed before upload',
        retryable: false,
        category: 'validation',
      })
    }
    selectedPackage.value = file
    sourceFormat.value = format
    resetRemoteState()
    phase.value = 'selected'
  }

  async function uploadAndValidate() {
    const file = selectedPackage.value
    const format = sourceFormat.value
    if (!file || !format) {
      throw new Error('Select a modpack package before uploading')
    }
    lastOperation = uploadAndValidate
    error.value = undefined
    phase.value = 'uploading'
    try {
      const created = await service.createImport(toValue(options.serverId), {
        fileName: file.name,
        sizeBytes: file.size,
        sourceFormat: format,
        idempotencyKey: keyFor('create-import'),
      })
      importId.value = created.importId
      if (!created.constraints.allowedFormats.includes(format) || file.size > created.constraints.maxSizeBytes) {
        throw new ModpackDeploymentApiException({
          error: 'upload_constraints_failed',
          message: 'The selected package exceeds the server upload constraints',
          requestId: 'client',
        }, 413)
      }
      const upload = await service.requestUploadUrl(created.importId, {
        sizeBytes: file.size,
        contentType: file.type || 'application/zip',
        idempotencyKey: keyFor('upload-url'),
      })
      await service.uploadPackage(upload, file)
      phase.value = 'validating'
      const task = await service.completeImport(created.importId, keyFor('complete-import'))
      await awaitTask(task)
      report.value = await awaitValidation(created.importId)
      reportConfirmed.value = false
      previewConfirmed.value = false
      phase.value = 'report'
    } catch (cause) {
      fail(cause)
      throw cause
    }
  }

  async function preparePreview() {
    if (!canPreparePreview.value || !importId.value) {
      throw new Error('Confirm a valid server report before generating the deployment preview')
    }
    lastOperation = preparePreview
    error.value = undefined
    phase.value = 'preparing-preview'
    try {
      const created = await service.createDeployment(
        toValue(options.serverId),
        importId.value,
        keyFor('create-deployment'),
      )
      deploymentId.value = created.deploymentId
      await awaitTask(created.task)
      deployment.value = await service.getDeployment(created.deploymentId)
      const previewTask = await service.preview(created.deploymentId, keyFor('preview'))
      const completed = await awaitTask(previewTask)
      preview.value = DeploymentPreviewSchema.parse(completed.result)
      previewConfirmed.value = false
      phase.value = 'preview'
    } catch (cause) {
      fail(cause)
      throw cause
    }
  }

  async function apply() {
    if (!canApply.value || !deploymentId.value || !deployment.value) {
      throw new Error('Confirm both the server validation report and deployment preview before applying')
    }
    lastOperation = apply
    error.value = undefined
    phase.value = 'applying'
    try {
      const task = await service.apply(
        deploymentId.value,
        deployment.value.statusVersion,
        keyFor('apply'),
      )
      await awaitTask(task)
      deployment.value = await service.getDeployment(deploymentId.value)
      phase.value = 'applied'
    } catch (cause) {
      await handleMutationFailure(cause)
      throw cause
    }
  }

  async function rollback() {
    if (!deploymentId.value || !deployment.value) {
      throw new Error('There is no deployment to roll back')
    }
    lastOperation = rollback
    error.value = undefined
    phase.value = 'rolling-back'
    try {
      const task = await service.rollback(
        deploymentId.value,
        deployment.value.statusVersion,
        keyFor('rollback'),
      )
      await awaitTask(task)
      deployment.value = await service.getDeployment(deploymentId.value)
      phase.value = 'rolled-back'
    } catch (cause) {
      await handleMutationFailure(cause)
      throw cause
    }
  }

  async function retry() {
    if (!error.value?.retryable || !lastOperation) return
    await lastOperation()
  }

  async function refreshDeployment() {
    if (!deploymentId.value) return
    deployment.value = await service.getDeployment(deploymentId.value)
  }

  async function loadHistory() {
    history.value = (await service.listDeployments(toValue(options.serverId))).items
  }

  async function awaitTask(initial: ModpackAsyncTask): Promise<ModpackAsyncTask> {
    acceptTask(initial)
    for (let attempt = 0; attempt < maxPollAttempts; attempt++) {
      const accepted = currentTask.value
      if (accepted?.taskId === initial.taskId && terminalTaskStatuses.has(accepted.status)) {
        if (accepted.status !== 'succeeded') {
          throw new ModpackDeploymentApiException(
            accepted.error ?? {
              error: accepted.status === 'cancelled' ? 'task_cancelled' : 'task_failed',
              message: accepted.status === 'cancelled' ? 'The deployment task was cancelled' : 'The deployment task failed',
              requestId: accepted.requestId,
            },
            409,
          )
        }
        return accepted
      }
      await sleep(pollIntervalMs)
      acceptTask(await service.getTask(initial.taskId))
    }
    throw new ModpackDeploymentApiException({
      error: 'task_timeout',
      message: 'The server task is still pending. Retry status refresh later.',
      requestId: initial.requestId,
    }, 504)
  }

  function acceptTask(next: ModpackAsyncTask) {
    const current = currentTask.value
    if (current?.taskId !== next.taskId) {
      currentTask.value = next
      return
    }
    if (terminalTaskStatuses.has(current.status)) return
    if (Date.parse(next.updatedAt) < Date.parse(current.updatedAt)) return
    currentTask.value = next
  }

  async function awaitValidation(id: string): Promise<ModpackValidationReport> {
    for (let attempt = 0; attempt < maxPollAttempts; attempt++) {
      const next = await service.getValidation(id)
      if (next.status !== 'pending') return next
      await sleep(pollIntervalMs)
    }
    throw new ModpackDeploymentApiException({
      error: 'validation_timeout',
      message: 'Server validation is still pending',
      requestId: currentTask.value?.requestId ?? 'unknown',
    }, 504)
  }

  async function handleMutationFailure(cause: unknown) {
    const normalized = normalizeError(cause)
    if (normalized.category === 'conflict' && deploymentId.value) {
      try {
        deployment.value = await service.getDeployment(deploymentId.value)
      } catch {
        // Keep the original conflict as the actionable error.
      }
      preview.value = undefined
      previewConfirmed.value = false
      idempotencyKeys.delete('preview')
      idempotencyKeys.delete('apply')
      phase.value = 'conflict'
      error.value = normalized
      return
    }
    fail(cause)
  }

  function fail(cause: unknown) {
    error.value = normalizeError(cause)
    phase.value = 'error'
  }

  function keyFor(operation: string) {
    let key = idempotencyKeys.get(operation)
    if (!key) {
      key = makeKey(operation)
      idempotencyKeys.set(operation, key)
    }
    return key
  }

  function resetRemoteState() {
    importId.value = undefined
    deploymentId.value = undefined
    report.value = undefined
    preview.value = undefined
    deployment.value = undefined
    currentTask.value = undefined
    error.value = undefined
    reportConfirmed.value = false
    previewConfirmed.value = false
    idempotencyKeys.clear()
    lastOperation = undefined
  }

  function setClientError(value: ModpackDeploymentClientError) {
    error.value = value
    phase.value = 'error'
    return value
  }

  return {
    phase,
    selectedPackage,
    sourceFormat,
    importId,
    deploymentId,
    report,
    preview,
    deployment,
    history,
    currentTask,
    error,
    reportConfirmed,
    previewConfirmed,
    busy,
    canPreparePreview,
    canApply,
    canRollback,
    selectPackage,
    uploadAndValidate,
    preparePreview,
    apply,
    rollback,
    retry,
    refreshDeployment,
    loadHistory,
  }
}

function normalizeError(cause: unknown): ModpackDeploymentClientError {
  if (cause instanceof ModpackDeploymentApiException) {
    return fromApiError(cause.response, cause.status)
  }
  if (cause instanceof TypeError) {
    return {
      code: 'network_error',
      message: cause.message,
      retryable: true,
      category: 'network',
    }
  }
  if (cause instanceof Error) {
    return {
      code: 'client_error',
      message: cause.message,
      retryable: false,
      category: 'unknown',
    }
  }
  return {
    code: 'unknown_error',
    message: 'An unknown modpack deployment error occurred',
    retryable: false,
    category: 'unknown',
  }
}

function fromApiError(value: ModpackApiError, status: number): ModpackDeploymentClientError {
  const code = value.error
  const category = status === 401 || status === 403
    ? 'auth'
    : status === 409 || code.includes('status_conflict')
      ? 'conflict'
      : code.includes('provider') || code.includes('modrinth') || code.includes('curseforge')
        ? 'provider'
        : code.includes('worker') || code.includes('staging') || code.includes('hash')
          ? 'worker'
          : code.includes('validation') || code.includes('package') || status === 413 || status === 422
            ? 'validation'
            : 'unknown'
  return {
    code,
    message: value.message,
    requestId: value.requestId,
    details: value.details,
    category,
    retryable: !['auth', 'validation', 'conflict'].includes(category),
  }
}
