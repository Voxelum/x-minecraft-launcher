
import { loading } from '../index';
import { Store } from 'vuex';

function autosave(store: Store<any>) {
    store.subscribe(
        (mutation) => {
            if (loading()) return;
            store.dispatch('save', { mutation: mutation.type, payload: mutation.payload });
        },
    );
}

export default autosave;
