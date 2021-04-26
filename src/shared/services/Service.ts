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

export type UnwrapServiceKey<T> = T extends ServiceKey<infer Z> ? Z : never

interface CustomFactory {
  dependencies: ServiceKey<any>[]
  factory(...deps: any[]): any
}
export class ServiceFactory {
  private cache: Record<string, any> = {}
  readonly customFactory: Record<string, CustomFactory> = {}

  constructor(private defaultFactoryFunction: <T>(key: ServiceKey<T>) => T) { }

  getService<T>(key: ServiceKey<T>): T {
    if (this.cache[key.toString()]) {
      return this.cache[key.toString()]
    }
    const customFactory = this.customFactory[key.toString()]
    const result = customFactory
      ? customFactory.factory(...customFactory.dependencies.map(d => this.getService(d)))
      : this.defaultFactoryFunction(key)
    this.cache[key.toString()] = result
    return result
  }

  register<T, S1 extends ServiceKey<any>, D1 extends UnwrapServiceKey<S1>>(serviceKey: ServiceKey<T>, deps: [S1], factory: (...deps: [D1]) => T): void
  register<T, S1 extends ServiceKey<any>, S2 extends ServiceKey<any>, D1 extends UnwrapServiceKey<S1>, D2 extends UnwrapServiceKey<S2>>(serviceKey: ServiceKey<T>, deps: [S1, S2], factory: (...deps: [D1, D2]) => T): void
  register<T, S1 extends ServiceKey<any>, S2 extends ServiceKey<any>, S3 extends ServiceKey<any>, D1 extends UnwrapServiceKey<S1>, D2 extends UnwrapServiceKey<S2>, D3 extends UnwrapServiceKey<S3>>(serviceKey: ServiceKey<T>, deps: [S1, S2, S3], factory: (...deps: [D1, D2, D3]) => T): void
  register<T>(serviceKey: ServiceKey<T>, deps: [], factory: (...deps: []) => T): void
  register(serviceKey: any, deps: any, factory: (...deps: any[]) => any) {
    this.customFactory[serviceKey] = {
      dependencies: deps,
      factory,
    }
  }
}
