import type {
  CloudServer,
  CloudServerApiErrorBody,
  CloudServerTask,
  CloudServerTaskAccepted,
  CloudServerUsage,
} from './CloudServerService'

export const cloudServerFixtures = {
  stopped: {
    serverId: 'srv_test_01',
    accountId: 'acct_test_01',
    provider: 'vultr',
    region: 'taipei',
    status: 'stopped',
    desiredStatus: 'stopped',
    statusVersion: 3,
  },
  taskAccepted: {
    taskId: 'task_start_01',
    requestId: 'req_start_01',
  },
  taskRunning: {
    taskId: 'task_start_01',
    requestId: 'req_start_01',
    status: 'running',
    resource: { type: 'server', id: 'srv_test_01' },
    createdAt: '2026-07-22T10:00:00.000Z',
    updatedAt: '2026-07-22T10:00:01.000Z',
  },
  taskProviderFailed: {
    taskId: 'task_start_01',
    requestId: 'req_start_01',
    status: 'failed',
    resource: { type: 'server', id: 'srv_test_01' },
    error: {
      error: 'provider_unavailable',
      message: 'The server provider is temporarily unavailable.',
      requestId: 'req_start_01',
    },
    createdAt: '2026-07-22T10:00:00.000Z',
    updatedAt: '2026-07-22T10:00:02.000Z',
  },
  usage: {
    serverId: 'srv_test_01',
    resource: 'server_time',
    unit: 'second',
    quantity: 3_600,
    from: '2026-07-22T09:00:00.000Z',
    to: '2026-07-22T10:00:00.000Z',
    updatedAt: '2026-07-22T10:00:02.000Z',
  },
} as const satisfies {
  stopped: CloudServer
  taskAccepted: CloudServerTaskAccepted
  taskRunning: CloudServerTask
  taskProviderFailed: CloudServerTask
  usage: CloudServerUsage
}

export const cloudServerErrorFixtures = {
  permission: {
    status: 403,
    body: {
      error: 'permission_denied',
      message: 'This account cannot control the server.',
      requestId: 'req_permission',
    },
  },
  balance: {
    status: 402,
    body: {
      error: 'usage_authorization_rejected',
      message: 'Server runtime authorization was rejected.',
      requestId: 'req_balance',
    },
  },
  quota: {
    status: 429,
    body: {
      error: 'quota_exceeded',
      message: 'The account server quota has been reached.',
      requestId: 'req_quota',
    },
  },
  provider: {
    status: 503,
    body: {
      error: 'provider_unavailable',
      message: 'The server provider is temporarily unavailable.',
      requestId: 'req_provider',
    },
  },
  api: {
    status: 409,
    body: {
      error: 'server_state_conflict',
      message: 'Server cannot start from its current state.',
      requestId: 'req_conflict',
      details: { status: 'stopping', statusVersion: 8 },
    },
  },
} as const satisfies Record<string, { status: number; body: CloudServerApiErrorBody }>
