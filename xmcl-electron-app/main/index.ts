import 'source-map-support/register'
import fs from 'fs'
import { gracefulify } from 'graceful-fs'
import ElectronLauncherApp from './ElectronLauncherApp'

gracefulify(fs)

new ElectronLauncherApp().start()

// import '@xmcl/runtime/native.test'
// import * as keytar from 'keytar'
// import * as util from '@xmcl/windows-utils'
// import NodeChannel from 'node-datachannel'
// console.log('good')
// console.log(keytar)
// console.log(NodeChannel)
// console.log(util)
// NodeChannel.initLogger('Error', (l, m) => {
//   console.log(l, m)
// })
