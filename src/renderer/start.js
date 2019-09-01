import Vue from 'vue';
import Vuetify from 'vuetify';
import VueObserveVisibility from 'vue-observe-visibility';
import colors from 'vuetify/es5/util/colors';
import draggable from 'vuedraggable';
import CurseforgeIcon from './CurseforgeIcon';
import SkinView from './skin/SkinView';
import TextComponent from './TextComponent';


if (!process.env.IS_WEB) {
    Vue.use(require('vue-electron'));
}
Vue.config.productionTip = false;

Vue.use(VueObserveVisibility);
Vue.use(Vuetify, {
    icons: {
        curseforge: {
            component: CurseforgeIcon,
        },
    },
    theme: {
        primary: colors.green,
        // secondary: colors.green,
        accent: colors.green.accent3,
    },
});

Vue.component('text-component', TextComponent);
Vue.component('skin-view', SkinView);
Vue.component('draggable', draggable);

/**
 * 
 * @param {import('vue').ComponentOptions} option 
 */
export default function (option) {
    const App = require('./App').default;
    const vue = new Vue({
        ...option,
        render: h => h(App),
    });
    Vue.prototype.$repo = vue.$store;
    vue.$mount('#app');
}
