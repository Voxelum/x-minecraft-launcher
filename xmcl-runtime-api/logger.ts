export interface GameOutput {
  on(event: 'minecraft-stdout', func: (log: string) => void): void
  on(event: 'minecraft-stderr', func: (log: string) => void): void
}
