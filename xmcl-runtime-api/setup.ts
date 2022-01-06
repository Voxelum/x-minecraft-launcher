export interface SetupAPI {
  preset(): Promise<{
    minecraftPath: string
    defaultPath: string
    locale: string
  }>
  setup(path: string): Promise<void>
}
