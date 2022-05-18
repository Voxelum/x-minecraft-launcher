import Controller from '@/Controller'
import { createServer } from 'http'
import { URL } from 'url'
import { ControllerPlugin } from './plugin'

export const auth: ControllerPlugin = function (this: Controller) {
  const { t } = this.i18n
  createServer((req, res) => {
    const url = new URL(req.url!, 'xmcl://launcher')
    if (this.app.handleUrl(url.toString())) {
      res.setHeader('content-type', 'text/plain; charset=utf-8')
      res.end(Buffer.from(t('loginSuccess'), 'utf-8'))
    } else {
      res.setHeader('content-type', 'text/plain; charset=utf-8')
      res.end(Buffer.from(t('urlFailed'), 'utf-8'))
    }
  }).listen(25555)
}
