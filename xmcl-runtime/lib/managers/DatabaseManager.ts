import { join } from 'path'
import { Manager } from '.'
import { PrismaClient } from '../database/client.gen'
export default class DatabaseManager extends Manager {
  private client!: PrismaClient

  async setup() {
    const databasePath = join(this.app.appDataPath, 'database.sqlite')
    // this.client = new PrismaClient({
    //   datasources: {
    //     db: {
    //       url: `file:${databasePath}`,
    //     },
    //   },
    // })

    // await this.client.$connect()
    // const count = await this.client.resource.count()
    // this.log(`COUNT ${count}`)
  }

  getClient() {
    return this.client
  }
}
