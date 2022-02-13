export interface SetupAPI {
  preset(): Promise<{
    minecraftPath: string
    defaultPath: string
    locale: string
    drives: Drive[]
  }>
  setup(path: string): Promise<void>
}
export interface Drive {
  filesystem: string
  blocks: number
  used: number
  available: number
  capacity: number
  mounted: string

  selectedPath: string
}
