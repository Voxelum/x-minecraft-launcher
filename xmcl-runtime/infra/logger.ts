
export interface Logger {
  log(message: any, ...options: any[]): void
  warn(message: any, ...options: any[]): void
  error(error: Error, scope?: string): void
}
