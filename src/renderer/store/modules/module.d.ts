import { ActionContext } from 'vuex'

interface Module {
    actions: {
        save(context: ActionContext, payload: { mutation: string });
        load(context: ActionContext);
    }
}
export default Module