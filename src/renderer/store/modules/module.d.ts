import { ActionContext } from 'vuex'

interface Module {
        actions: {
                save(context: ActionContext<any, any>, payload: { mutation: string });
                load(context: ActionContext<any, any>);
        }
}
export default Module
