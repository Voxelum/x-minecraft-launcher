export interface Range {
  start: number
  end: number
}

export interface RangePolicy {
  rangeThreshold: number
  /**
   * Compute ranges for a specific portion of the file.
   * @param start The start position (inclusive)
   * @param end The end position (inclusive)
   * @returns Array of ranges within the specified portion
   */
  computeRangesInRange(start: number, end: number): Range[]
}

export function isRangePolicy(
  rangeOptions?: RangePolicy | DefaultRangePolicyOptions,
): rangeOptions is RangePolicy {
  if (!rangeOptions) {
    return false
  }
  return 'computeRanges' in rangeOptions && typeof rangeOptions.computeRanges === 'function'
}

export function resolveRangePolicy(rangeOptions?: RangePolicy | DefaultRangePolicyOptions) {
  if (isRangePolicy(rangeOptions)) {
    return rangeOptions
  }
  return new DefaultRangePolicy(
    rangeOptions?.rangeThreshold ?? 1024 * 1024 * 5, // 5MB
    4,
  )
}

export interface DefaultRangePolicyOptions {
  /**
   * The minimum bytes a range should have.
   * @default 5MB
   */
  rangeThreshold?: number
}

export class DefaultRangePolicy implements RangePolicy {
  constructor(
    public rangeThreshold: number,
    public concurrency: number,
  ) {}

  computeRangesInRange(start: number, end: number): Range[] {
    const total = end - start + 1
    const { rangeThreshold: minChunkSize } = this
    if (total <= minChunkSize) {
      return [{ start, end }]
    }
    const partSize = Math.max(minChunkSize, Math.floor(total / this.concurrency))
    const ranges: Range[] = []
    for (let cur = start, chunkSize = 0; cur <= end; cur += chunkSize) {
      const remain = end - cur + 1
      if (remain >= partSize) {
        chunkSize = partSize
        ranges.push({ start: cur, end: cur + chunkSize - 1 })
      } else {
        const last = ranges[ranges.length - 1]
        if (!last) {
          ranges.push({ start, end })
        } else {
          last.end = end
        }
        break
      }
    }
    return ranges
  }
}
