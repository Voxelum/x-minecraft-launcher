// eslint-disable-next-line @typescript-eslint/no-var-requires
require('graceful-fs').gracefulify(require('node:fs'))

import { app } from 'deskgap'
import { DeskGapLauncherApp } from './launcherApp'

if (process.platform === 'win32') app.setAppUserModelId('xmcl.deskgap.local')

void new DeskGapLauncherApp().start()