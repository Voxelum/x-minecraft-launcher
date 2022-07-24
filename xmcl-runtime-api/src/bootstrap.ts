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
  preset(): Promise<{
    minecraftPath: string
    defaultPath: string
    locale: string
    drives: Drive[]
  }>
  bootstrap(
    path: string,
    instancePath: string,
    locale: string,
  ): Promise<void>
}
