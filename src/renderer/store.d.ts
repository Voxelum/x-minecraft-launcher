import { StoreOptions } from 'vuex'
export interface Store {
    [moduleId: string]: StoreOptions<any>
}
declare const store: Store
export default store