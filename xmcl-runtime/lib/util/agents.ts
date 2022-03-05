import { HttpProxyAgent, HttpsProxyAgent } from 'hpagent'
import { Agent } from 'http'
import { Agent as SAgent } from 'https'

export class HttpAgent extends HttpProxyAgent {
  enabled = false
  createConnection(options: any, callback: any) {
    if (this.enabled && (this as any).proxy) {
      // @ts-expect-error
      return super.createConnection(options, callback)
    } else {
      // @ts-expect-error
      return Agent.prototype.createConnection.call(this, options, callback)
    }
  }
}

export class HttpsAgent extends HttpsProxyAgent {
  enabled = false
  createConnection(options: any, callback: any) {
    if (this.enabled && (this as any).proxy) {
      // @ts-expect-error
      return super.createConnection(options, callback)
    } else {
      // @ts-expect-error
      const createConnection = SAgent.prototype.createConnection
      return createConnection.call(this, options, callback)
    }
  }
}
