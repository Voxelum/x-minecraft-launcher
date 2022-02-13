/* eslint-disable */

// declare module 'vue' {
//   export interface GlobalComponents {
//   }
// }

// declare module '@vue/runtime-dom' {
//   export interface ComponentPublicInstance {
//     $t(key: string, ...args: any[]): string
//     $tc(key: string, count: number): string
//   }
// }

// declare module '@vue/composition-api' {
//   export * from '@vue/runtime-dom'
//   export * from '@vue/composition-api/dist/index'
// }

declare module 'vue/types/vue' {
  interface Vue {
    $t: (key: string, values?: any) => any
    $t: (key: string) => any
  }
}

export {}

