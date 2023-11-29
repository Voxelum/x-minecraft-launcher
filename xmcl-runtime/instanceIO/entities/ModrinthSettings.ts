export interface ModrinthSettings {
  java_globals: Record<string, {
    path: string
    version: string
    architecture: string
  }>
}
