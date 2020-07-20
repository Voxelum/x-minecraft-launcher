// import 'vuetify/dist/vuetify.css';
import '@/assets/google.font.css';
import { I18N_KEY } from '@/constant';
import provideElectron from '@/providers/provideElectron';
import VueCompositionApi, { h, provide } from '@vue/composition-api';
import Vue from 'vue';
import VueI18n from 'vue-i18n';
import 'vuetify/dist/vuetify.min.css';
import VApp from 'vuetify/es5/components/VApp';
import VBtn from 'vuetify/es5/components/VBtn';
import VCard from 'vuetify/es5/components/VCard';
import VGrid from 'vuetify/es5/components/VGrid';
import VIcon from 'vuetify/es5/components/VIcon';
import VDivider from 'vuetify/es5/components/VDivider';
import VList from 'vuetify/es5/components/VList';
import VProgressCircular from 'vuetify/es5/components/VProgressCircular';
import Vuetify from 'vuetify/es5/components/Vuetify';
import colors from 'vuetify/es5/util/colors';
import Setup from './Setup.vue';

Vue.config.productionTip = false;

Vue.use(VueCompositionApi);
Vue.use(Vuetify, {
    theme: {
        primary: colors.green,
        // secondary: colors.green,
        accent: colors.green.accent3,
    },
    components: {
        ...VCard.$_vuetify_subcomponents,
        ...VList.$_vuetify_subcomponents,
        ...VGrid.$_vuetify_subcomponents,
        VProgressCircular,
        VDivider,
        VApp,
        VBtn,
        VIcon,
    },
});

Vue.use(VueI18n);

const i18n = new VueI18n({
    locale: 'en',
    fallbackLocale: 'en',
    messages: {
        en: {
            title: 'Welcome to KeyStone UI. Before start, we need you to setup the root directory of game data',
            defaultPath: 'Default Path',
            path: 'Current Path',
            browse: 'Browse',
            confirm: 'Start',
        },
        'zh-CN': {
            title: '欢迎使用 KeyStone UI。在开始前，需要您先设置游戏数据存储目录',
            defaultPath: '默认位置',
            path: '当前位置',
            browse: '浏览',
            confirm: '开始',
        },
    },
    missing: () => {
        // handle translation missing
    },
    silentTranslationWarn: true,
});
const vue = new Vue({
    i18n,
    setup() {
        provideElectron();
        provide(I18N_KEY, i18n);
        return () => h(Setup);
    },
});

vue.$mount('#app');
