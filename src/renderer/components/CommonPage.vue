<template>
    <div class="ui celled grid noselect">
        <div class="black row moveable">
            <div class="black four wide middle aligned center aligned column">
                <h2 class="inverted ui header">
                    ILauncher
                </h2>
            </div>
            <div class="ten wide column">
                <div class="ui breadcrumb">
                    <a class="section">
                        <button class="ui inverted circular button" @click="unselect">Home</button>
                    </a>
                    <span v-if="selecting">
                        <i class="right chevron inverted icon divider" style="color:white"></i>
                        <a class="section">
                            <button class="ui inverted circular button">{{selectedProfile.name}}</button>
                        </a>
                    </span>
                </div>
            </div>
        </div>
        <div class="row">
            <div class="four wide middle aligned center aligned column">
                <div class="ui header segment">{{playerName}}</div>
                <!--<skin-view width="1200" height="400"></skin-view>-->
                <div class="ui segment">
                    <button class="ui icon button">
                        <i class="setting icon"></i>
                    </button>
                </div>
            </div>
            <div class="ten wide column">
                <div v-if="selecting">
                    <profile-view :source='selectedProfile' :id="selectProfileID"></profile-view>
                </div>
                <div v-else>
                    <div class="ui link cards">
                        <profile-card class="profile" v-for="id in keys" :key="id" :id="id" :source='getByKey(id)' @select="selectProfile"></profile-card>
                    </div>
                    <button id="addElement" class="ui icon right floated button" @click="createProfile({type:'modpack', option:{author:playerName}})">
                        <i class="plus icon"></i>
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
import ProfileCard from './widgets/ProfileCard'
import ProfileView from './widgets/ProfileView'

import { mapMutations, mapState, mapActions, mapGetters } from 'vuex'

export default {
    computed: {
        selecting() {
            console.log('cal selecting')
            console.log(this.selectProfileID)
            return this.selectProfileID != undefined && this.selectProfileID != '' && this.selectProfileID != null
        },
        ...mapGetters('profiles', {
            'selectedProfile': 'selected',
            'profiles': 'allStates',
            'keys': 'allKeys',
            'getByKey': 'getByKey',
            'selectProfileID': 'selectedKey'
        }),
        playerName() {
            return this.$store.state.auth.playerName;
        }
    },
    mounted(e) {
        $('.dropdown').dropdown({
            onChange: (value, text, $selectedItem) => {
            }
        })
        // $('.profile')
        //     .transition({
        //         animation: 'scale',
        //         reverse: 'auto', // default setting
        //         interval: 200
        //     });
    },
    methods: {
        ...mapActions('profiles', {
            createProfile: 'create'
        }),
        ...mapMutations('profiles', {
            selectProfile: 'select',
            unselect: 'unselect'
        }),
    },
    components: { ProfileCard, ProfileView }
}
</script>

<style scoped>
/* .moveable {
    -webkit-app-region: drag
} */
</style>