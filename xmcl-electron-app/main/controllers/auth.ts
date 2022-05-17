import Controller from '@/Controller'
import { createServer } from 'http'
import { URL } from 'url'
import { ControllerPlugin } from './plugin'

export const auth: ControllerPlugin = function (this: Controller) {
  const { t } = this.i18n
  createServer((req, res) => {
    const url = new URL(req.url!, 'xmcl://launcher')
    const code = url.searchParams.get('code')!
    if (code) {
      this.app.emit('microsoft-authorize-code', undefined, code)
      res.setHeader('content-type', 'text/plain; charset=utf-8')
      res.end(Buffer.from(t('loginSuccess'), 'utf-8'))
    } else {
      this.app.warn(`Skip to emit auth code as the code is empty! ${req.url!}`)
    }
  }).listen(25555)
}
