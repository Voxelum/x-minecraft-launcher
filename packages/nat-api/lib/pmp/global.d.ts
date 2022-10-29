declare module 'default-gateway' {
  export function v4(): Promise<Gateway>
  export function v6(): Promise<Gateway>

  export interface Gateway {
    gateway: string
    interface: string
  }
}
