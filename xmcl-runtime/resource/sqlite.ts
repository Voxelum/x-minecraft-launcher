import SQLite from 'better-sqlite3'
import { join } from 'path'
import { NativeModuleLoader } from '~/util/NativeModule'
import { dependencies } from '../package.json'

const version = dependencies['better-sqlite3']
const os = process.platform
const arch = process.arch
const modules = process.versions.modules
const url = `https://github.com/WiseLibs/better-sqlite3/releases/download/v${version}/better-sqlite3-v${version}-electron-v${modules}-${os}-${arch}.tar.gz`

export const SQLiteModule = new NativeModuleLoader('better_sqlite3.node', () => [url, url], (root, nativeBinding) => new SQLite(join(root, 'resources.sqlite'), {
  nativeBinding,
}))
