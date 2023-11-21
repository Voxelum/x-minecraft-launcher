export interface SecretStorage {
  get(service: string, account: string): Promise<string | undefined>
  put(service: string, account: string, value: string): Promise<void>
}
