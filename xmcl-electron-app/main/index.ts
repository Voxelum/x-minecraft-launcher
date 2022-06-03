import ElectronLauncherApp from './ElectronLauncherApp'
import schemaPath from '../../xmcl-runtime/lib/database/client.gen/schema.prisma'
import enginePath from '../../xmcl-runtime/lib/database/client.gen/query_engine-windows.dll.node?static'
// inject the prisma build
process.env.PRISMA_QUERY_ENGINE_LIBRARY = enginePath
process.env.PRISMA_SCHEMA_PATH = schemaPath

new ElectronLauncherApp().start()
