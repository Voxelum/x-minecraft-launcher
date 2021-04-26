export interface VuexModule {

}

export type Commit<T> = <K extends keyof T>(mutation: K, payload: T[K]) => void
