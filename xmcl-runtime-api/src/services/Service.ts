/* eslint-disable no-dupe-class-members */

export interface ServiceKey<T> extends String { }

export interface StatefulService<M extends State<M>> {
  state: M
}

export type NoPromiseType<T> = {
  [key in keyof T]: T[key] extends Promise<any> ? never : T[keyof T]
}

export type State<T> = {
  [key in keyof T]: NotPromise | ((payload: any) => void)
}

type Not<T> = { [P in keyof T]?: void; }
type NotPromise = Not<Promise<any>> | number | string | any[] | boolean | bigint | object | undefined | null
