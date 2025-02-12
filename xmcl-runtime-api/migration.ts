export interface Migration {
  getProgress(): Promise<{ from: string, to: string, progress: number, total: number }>
  on(event: 'progress', func: (payload: { from: string, to: string, progress: number, total: number }) => void): void
  on(event: 'error', func: (paylod: { from: string, to: string, error: object }) => void): void
}
