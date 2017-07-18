<template>
    <div class="ui celled grid">
        <div class="black row moveable">
            <div class="black four wide middle aligned center aligned column">
                <h2 class="inverted ui header">
                    ILauncher
                </h2>
            </div>
            <div class="ten wide column">
                <div class="ui breadcrumb">
                    <a class="section">
                        <div class="ui inverted circular button">Home</div>
                    </a>
                    <i class="right chevron inverted icon divider" style="color:white"></i>
                    <a class="section">
                        <div class="ui inverted circular button">ModPack</div>
                    </a>
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
                <div class="ui link cards">
                    <profile class="profile" v-for="profile in profiles" :key="profile" :source='profile' @select="onSelect(profile)"></profile>
                </div>
                <button id="addElement" class="ui icon right floated button" @click="createProfile({type:'modpack', option:{author:playerName}})">
                    <i class="plus icon"></i>
                </button>
                <!-- <div id="addPopup" class="ui popup right transition visible animating scale out" style="background-color:transparent; ">
                                                                                                    <div class="ui two column left aligned grid" style="background-color:transparent;">
                                                                                                        <div class="column" style="background-color:transparent;">
                                                                                                            <button class="ui button" @click="create('server')">Server</button>
                                                                                                        </div>
                                                                                                        <div class="column" style="background-color:transparent;">
                                                                                                            <button class="ui button" @click="create('modpack')">Modpack</button>
                                                                                                        </div>
                                                                                                    </div>
                                                                                                </div> -->
            </div>
        </div>
    </div>
</template>

<script>
import SkinView from './widget/SkinViewer'
import profile from './widget/Profile'
import { mapMutations, mapState, mapActions } from 'vuex'

export default {
    computed: {
        ...mapState('profiles', {
            'profiles': 'all'
        }),
        playerName() {
            return this.$store.state.auth.playerName;
        }
    },
    mounted(e) {
        // $('#addElement').popup({
        //     hoverable: true,
        //     position: 'left center', 
        // })
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
        onSelect(event) {
        },
    },
    components: {
        SkinView, profile
    }
}
</script>

<style scoped>
.moveable {
    -webkit-app-region: drag
}
</style>