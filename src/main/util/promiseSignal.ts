export function createPromiseSignal<T = void>(): PromiseSignal<T> {
  let __resolve: (v: T) => void = () => { }
  let __reject: (e: any) => void = () => { }
  const promise = new Promise<T>((resolve, reject) => {
    __resolve = resolve
    __reject = reject
  })
  return {
    promise,
    resolve: __resolve,
    reject: __reject,
    accept: (p) => p.then(__resolve, __reject),
  }
}

export interface PromiseSignal<T> {
  promise: Promise<T>
  resolve: (v: T) => void
  reject: (e: any) => void
  accept: (p: Promise<T>) => void
}
