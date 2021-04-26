
export interface LauncherAppController {
  processFirstLaunch(): Promise<string>
  requireFocus(): void
  engineReady(): Promise<void>
  dataReady(): Promise<void>
}
