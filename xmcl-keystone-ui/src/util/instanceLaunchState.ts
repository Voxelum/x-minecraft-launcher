export function getCurrentInstanceState<T extends { instance: string }>(
  state: T | undefined,
  instancePath: string,
): T | undefined {
  return state?.instance === instancePath ? state : undefined
}