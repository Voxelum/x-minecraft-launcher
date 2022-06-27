import { join } from 'path'
import { Manager } from '.'
import { ClassicLevel } from 'classic-level'
import { Resource } from '@xmcl/runtime-api'
export default class DatabaseManager extends Manager {

  async setup() {
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
  }
}
