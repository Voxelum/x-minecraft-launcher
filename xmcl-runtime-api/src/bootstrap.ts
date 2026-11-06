export interface Drive {
  filesystem: string
  blocks: number
  used: number
  available: number
  capacity: number
  mounted: string

  selectedPath: string
}

export interface Bootstrap {
  xmclImport: {
    preview(source?: string): Promise<XmclImportPreview | undefined>
    status(): Promise<XmclImportStatus>
    copy(): Promise<void>
    cancel(): Promise<void>
    activate(): Promise<void>
    rollback(): Promise<void>
    restart(): Promise<void>
  }
  preset(): Promise<{
    minecraftPath: string
    defaultPath: string
    locale: string
    drives: Drive[]
  }>
  bootstrap(
    path: string
  ): Promise<void>
}

export interface XmclImportPreview {
  sourceProfile: string
  sourceRoot: string
  destination: string
  instances: number
  accounts: number
  files: number
  bytes: number
}

export interface XmclImportStatus {
  phase: 'idle' | 'copying' | 'cancelled' | 'failed' | 'ready' | 'activate-pending' | 'applying' | 'applied' | 'rollback-pending' | 'rolled-back'
  sourceProfile?: string
  destination?: string
  copiedFiles: number
  totalFiles: number
  copiedBytes: number
  totalBytes: number
  error?: string
}
