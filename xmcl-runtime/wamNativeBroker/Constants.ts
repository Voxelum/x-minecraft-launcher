/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

export const ErrorCodes = {
  INTERATION_REQUIRED_ERROR_CODE: 'interaction_required',
  SERVER_UNAVAILABLE: 'server_unavailable',
  UNKNOWN: 'unknown_error',
} as const

// eslint-disable-next-line @typescript-eslint/no-redeclare
export type ErrorCodes = (typeof ErrorCodes)[keyof typeof ErrorCodes]
