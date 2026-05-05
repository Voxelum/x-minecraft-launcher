declare module 'vitest' {
  export interface TestContext {
    mock: string
    temp: string
  }
}
export {}