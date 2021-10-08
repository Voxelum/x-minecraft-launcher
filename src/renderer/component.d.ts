// declare module 'vue' {
//   export interface GlobalComponents {
//   }
// }

// declare module '@vue/runtime-dom' {
// 	export * from '@vue/runtime-dom/dist/runtime-dom'
// 	export { defineComponent, PropType } from '@vue/composition-api'
// }

declare module '@vue/composition-api' {
  export * from '@vue/runtime-dom'
  export * from '@vue/composition-api/dist/index'
}
