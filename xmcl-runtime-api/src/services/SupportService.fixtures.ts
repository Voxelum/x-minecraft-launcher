import type { SupportTicketSubmission } from './SupportService'

export const supportTicketFixtures = {
  refundRequest: {
    type: 'refund_request',
    idempotencyKey: 'support-refund-001',
    subject: 'Refund request for a duplicate purchase',
    description: 'I was charged twice for the same purchase.',
    purchaseReference: 'purchase_001',
  },
  accountDeletion: {
    type: 'account_deletion',
    idempotencyKey: 'support-delete-001',
    subject: 'Delete my XMCL account',
    description: 'Please delete my account and associated support history.',
    confirmation: 'DELETE',
  },
  serverAppeal: {
    type: 'server_appeal',
    idempotencyKey: 'support-appeal-001',
    subject: 'Appeal a server suspension',
    description: 'Please review the suspension and the associated audit trail.',
    serverId: 'server_001',
  },
  errorFeedback: {
    type: 'error_feedback',
    idempotencyKey: 'support-feedback-001',
    subject: 'Launcher startup error',
    description: 'The launcher closes immediately after startup.',
    errorCode: 'LAUNCHER_STARTUP_FAILED',
    launcherVersion: '0.61.4',
  },
  sensitiveContent: {
    type: 'error_feedback',
    idempotencyKey: 'support-sensitive-001',
    subject: 'Do not submit credentials',
    description: 'access token: not-a-real-token',
  },
} as const satisfies Record<string, SupportTicketSubmission>
