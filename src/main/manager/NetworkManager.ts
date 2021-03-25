import LauncherApp from '/@main/app/LauncherApp'
import { Agents, DownloadBaseOptions } from '@xmcl/installer'
import got from 'got'
import { Agent as HttpAgent } from 'http'
import { Agent as HttpsAgent, AgentOptions } from 'https'
import { cpus } from 'os'
import { Manager } from '.'

export default class NetworkManager extends Manager {
  private inGFW = false

  private agents: Agents

  private headers: Record<string, string> = {}

  readonly request = got.extend({})

  constructor(app: LauncherApp) {
    super(app)
    const options: AgentOptions = {
      keepAlive: true,
      maxSockets: cpus().length * 4,
      rejectUnauthorized: false,
    }
    this.agents = ({
      http: new HttpAgent(options),
      https: new HttpsAgent(options),
    })
  }

  getDownloadBaseOptions(): DownloadBaseOptions {
    return {
      agents: this.agents,
      headers: this.headers,
      overwriteWhen: 'checksumNotMatchOrEmpty',
    } as const
  }

  /**
   * Update the status of GFW
   */
  async updateGFW() {
    this.inGFW = await Promise.race([
      this.request.head('https://npm.taobao.org', { throwHttpErrors: false }).then(() => true, () => false),
      this.request.head('https://www.google.com', { throwHttpErrors: false }).then(() => false, () => true),
    ])
    this.log(this.inGFW ? 'Detected current in China mainland.' : 'Detected current NOT in China mainland.')
    return this.inGFW
  }

  /**
   * Return if current environment is in GFW.
   */
  get isInGFW() {
    return this.inGFW
  }

  // setup code
  setup() {
    this.updateGFW()
  }
}
