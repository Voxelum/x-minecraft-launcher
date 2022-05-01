/* eslint-disable no-unused-vars */

// declare electron static for static file serving
/* eslint-disable no-unused-vars */

// declare electron static for static file serving

declare module '*?worker' {
  import { Worker, WorkerOptions } from 'worker_threads'

  export const path: string
  /**
   * The helper to create the worker
   */
  export default function (options?: WorkerOptions): Worker
}

declare module '*.vbs' {
  const path: string
  export default path
}
