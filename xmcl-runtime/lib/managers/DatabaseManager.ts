import { join } from 'path'
import { Manager } from '.'
import { PrismaClient } from '../database/client.gen'

export default class DatabaseManager extends Manager {
  private client: PrismaClient

  setup() {
    const databasePath = join(this.app.appDataPath, 'database.sqlite')
    this.client = new PrismaClient({ 
      datasources: {
        db: {
          url: `file:${databasePath}`
        }
      }
    })
  }

  getClient() {
    return this.client
  }
}