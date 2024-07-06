import { DatabaseConnection } from 'kysely'

export interface DatabaseWorker extends DatabaseConnection {
  init(): Promise<void>
  destroy(): Promise<void>
}
