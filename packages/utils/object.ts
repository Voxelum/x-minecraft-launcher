/**
 * Filter out null/undefined values
 */
export function isNonnull<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined
}
