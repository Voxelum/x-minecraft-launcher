const int8 = new Int8Array(4)
const int32 = new Int32Array(int8.buffer, 0, 1)
const float32 = new Float32Array(int8.buffer, 0, 1)

export const SHORT_MIN = -32768
export const SHORT_MAX = 32768

export function intBitsToFloat(bits: number): number {
  int32[0] = bits
  return float32[0]
}

export function floatToIntBits(bits: number): number {
  float32[0] = bits
  return int32[0]
}

const int16 = new Int16Array(4)
const int64 = new Int32Array(int16.buffer, 0, 2)
const float64 = new Float64Array(int16.buffer, 0, 1)

export function longBitsToDouble(bits: bigint): number {
  int64[0] = Number((bits >> 32n) & 0xffffffffn)
  int64[1] = Number(bits & 0xffffffffn)
  return float64[0]
}

export function doubleToLongBits(double: number): bigint {
  float64[0] = double
  return (BigInt(int64[1]) << 32n) & BigInt(int64[0])
}
