export function useSingleton<T extends (...args: any[]) => Promise<any>>(f: T): T {
  const active = ref<Promise<ReturnType<T>> | undefined>(undefined)
  return ((...args: Parameters<T>): any => {
    if (active.value) {
      return active.value
    }
    active.value = new Promise((resolve, reject) => {
      try {
        const result = f(...args)
        resolve(result)
      } catch (error) {
        reject(error)
      } finally {
        active.value = undefined
      }
    })
    return active.value
  }) as any
}