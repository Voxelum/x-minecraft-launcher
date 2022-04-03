export interface Monitor {
  on(event: 'minecraft-start', func: (event: {
    pid?: number
    version: string
    minecraft: string
    forge: string
    fabricLoader: string
  }) => void): void
  on(event: 'minecraft-window-ready', func: (event: { pid?: number }) => void): void
  on(event: 'minecraft-exit', func: (event: { pid?: number; code?: number; signal?: string; crashReport?: string; crashReportLocation?: string; errorLog: string }) => void): void
  on(event: 'minecraft-stdout', func: (event: { stdout: string; pid: number }) => void): void
  on(event: 'minecraft-stderr', func: (event: { stderr: string; pid: number }) => void): void
}
