// declare module 'vue' {
//   export interface GlobalComponents {
//   }
// }

declare module '@vue/runtime-dom' {
// export * from '@vue/runtime-dom/dist/runtime-dom'
// export { defineComponent, PropType } from '@vue/composition-api'
  export interface ComponentPublicInstance {
    $t(key: string, ...args: any[]): string
    $tc(key: string, count: number): string
  }
}

declare module '@vue/composition-api' {
  export * from '@vue/runtime-dom'
  export * from '@vue/composition-api/dist/index'
}

export {}
