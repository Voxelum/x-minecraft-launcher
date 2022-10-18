import { Ref, ref } from 'vue'

export function useOperation<T, A = void> (defaultValue: T, operation: (value: T, argument: A) => void | Promise<void>) {
  const data: Ref<T> = ref<T>(defaultValue) as any
  return {
    data,
    begin (value: T) { data.value = value },
    cancel () { data.value = defaultValue },
    operate (argument: A) {
      const value = data.value
      const result = operation(value, argument)
      if (result) {
        result.finally(() => {
          data.value = defaultValue
        })
      } else {
        data.value = defaultValue
      }
    },
  }
}
