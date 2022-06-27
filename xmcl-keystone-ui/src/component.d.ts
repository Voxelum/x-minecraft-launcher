/* eslint-disable */
declare module 'vue/types/vue' {
  interface Vue {
    $t: (key: string, values?: any) => any
    $t: (key: string) => any
  }
}

export {}

