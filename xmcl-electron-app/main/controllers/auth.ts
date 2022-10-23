import Controller from '@/Controller'
import { createServer } from 'http'
import { URL } from 'url'
import { ControllerPlugin } from './plugin'

export const auth: ControllerPlugin = function (this: Controller) {
  const { t } = this.i18n
  const setupServer = (port: number) => {
    this.app.log(`Try to use ${port} as local auth server port.`)
    const server = createServer((req, res) => {
      const url = new URL(req.url!, 'xmcl://launcher')
      if (this.app.handleUrl(url.toString())) {
        res.setHeader('content-type', 'text/plain; charset=utf-8')
        res.end(Buffer.from(t('loginSuccess'), 'utf-8'))
      } else {
        res.setHeader('content-type', 'text/plain; charset=utf-8')
        res.end(Buffer.from(t('urlFailed'), 'utf-8'))
      }
    })

    server.listen(port)
    const errorHandler = () => {
      this.app.warn(`Fail to use ${port} as the local auth server port.`)
      setupServer(port + 7)
    }
    server.on('error', errorHandler)
    server.on('listening', () => {
      server.removeListener('error', errorHandler)
      this.app.localhostServerPort.resolve(port)
      this.app.log(`Successfully bind to the port ${port} for localhost auth server.`)
    })
  }
  setupServer(25555)
}
