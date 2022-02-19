// From https://github.com/andnp/SimplyTyped/blob/master/src/types/objects.ts
export type DeepPartial<T > = Partial<{
  [k in keyof T]:
  T[k] extends unknown[] ? Array<DeepPartial<T[k][number]>> :
    T[k] extends Function ? T[k] :
      T[k] extends object ? DeepPartial<T[k]> :
        T[k];
}>
