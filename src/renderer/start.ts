import Vue, { ComponentOptions } from 'vue';
import Vuetify from 'vuetify';
import VueCompositionApi from '@vue/composition-api';
import VueObserveVisibility from 'vue-observe-visibility';
import colors from 'vuetify/es5/util/colors';
import CurseforgeIcon from './CurseforgeIcon.vue';
import SkinView from './skin/SkinView.vue';
import TextComponent from './TextComponent.vue';

Vue.use(VueCompositionApi);

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

export default function (option: ComponentOptions<Vue>) {
    const App = require('./App').default;
    const vue = new Vue({
        ...option,
        render: h => h(App),
    });
    Vue.prototype.$repo = vue.$store;
    vue.$mount('#app');
}
