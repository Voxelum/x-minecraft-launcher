
import { Store } from 'vuex';
import { install } from '../../taskManager';

function taskNotifier(store: Store<any>) {
    install(store);
}

export default taskNotifier;
