import { app } from 'electron'
import ElectronLauncherApp from './electron/ElectronLauncherApp'

new ElectronLauncherApp().start()

app.on('web-contents-created', (event, contents) => {
  // const extensionDir = join(__dirname, '../extensions')
  // if (existsSync(extensionDir)) {
  //   contents.session.loadExtension(extensionDir)
  // }
  contents.openDevTools({ mode: 'detach' })
})
