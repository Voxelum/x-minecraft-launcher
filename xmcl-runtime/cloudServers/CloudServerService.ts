import {
  CloudServerApiClient,
  CloudServerServiceKey,
  type CloudServer,
  type CloudServerCreateRequest,
  type CloudServerLogPage,
  type CloudServerLogsOptions,
  type CloudServerMutationOptions,
  type CloudServerService as ICloudServerService,
  type CloudServerTask,
  type CloudServerTaskAccepted,
  type CloudServerUsage,
} from '@xmcl/runtime-api'
import { Inject, LauncherApp, LauncherAppKey } from '~/app'
import { AbstractService, ExposeServiceKey } from '~/service'
import { CommercialAccountService, kCommercialSessionAuthorization } from '~/commercialAccount'

/**
 * The main-process M4 API consumer. It delegates authorization to the M1
 * commercial session and never exposes session or provider credentials to the
 * renderer.
 */
@ExposeServiceKey(CloudServerServiceKey)
export class CloudServerService extends AbstractService implements ICloudServerService {
  private readonly client: CloudServerApiClient

  constructor(
    @Inject(LauncherAppKey) app: LauncherApp,
    @Inject(CommercialAccountService) account: CommercialAccountService,
  ) {
    super(app)
    this.client = new CloudServerApiClient({
      fetch: ((input, init) => app.fetch(input, init)) as typeof fetch,
      getSessionToken: async () => (await account[kCommercialSessionAuthorization]())?.accessToken,
    })
  }

  listServers(): Promise<CloudServer[]> {
    return this.client.listServers()
  }

  getServer(serverId: string): Promise<CloudServer> {
    return this.client.getServer(serverId)
  }

  getServerLogs(options: CloudServerLogsOptions): Promise<CloudServerLogPage> {
    return this.client.getServerLogs(options)
  }

  createServer(
    request: CloudServerCreateRequest,
    options: CloudServerMutationOptions,
  ): Promise<CloudServerTaskAccepted> {
    return this.client.createServer(request, options)
  }

  startServer(
    serverId: string,
    options: CloudServerMutationOptions,
  ): Promise<CloudServerTaskAccepted> {
    return this.client.startServer(serverId, options)
  }

  stopServer(
    serverId: string,
    options: CloudServerMutationOptions,
  ): Promise<CloudServerTaskAccepted> {
    return this.client.stopServer(serverId, options)
  }

  restartServer(
    serverId: string,
    options: CloudServerMutationOptions,
  ): Promise<CloudServerTaskAccepted> {
    return this.client.restartServer(serverId, options)
  }

  deleteServer(
    serverId: string,
    options: CloudServerMutationOptions,
  ): Promise<CloudServerTaskAccepted> {
    return this.client.deleteServer(serverId, options)
  }

  getTask(taskId: string): Promise<CloudServerTask> {
    return this.client.getTask(taskId)
  }

  getUsage(serverId: string): Promise<CloudServerUsage> {
    return this.client.getUsage(serverId)
  }
}
