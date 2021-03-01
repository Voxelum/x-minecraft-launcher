import Vue, { Component } from 'vue'
declare module '*.vue' {
  export default Vue
}
declare module '*.webp' {
  const value: string
  export default value
}
declare module 'vue-particles' {
  const module: import('vue').PluginObject<any>
  export default module
}
declare module 'vue-virtual-scroll-list' {
  const component: Component<any, any, any, { size: number; remain: number }>
  export = component;
}
