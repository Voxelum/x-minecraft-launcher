import { CUSTOM_RPC_ERROR_CODE, RPC_ERROR_CODE } from '../structures/Transport'

export class RPCError extends Error {
  code: RPC_ERROR_CODE | CUSTOM_RPC_ERROR_CODE
  message = ''

  get name() {
    return `${{ ...CUSTOM_RPC_ERROR_CODE, ...RPC_ERROR_CODE }[this.code]}`
  }

  constructor(errorCode: CUSTOM_RPC_ERROR_CODE | RPC_ERROR_CODE, message?: string, options?: any) {
    super(message)

    this.code = errorCode
    this.message = message ?? this.message
  }
}
