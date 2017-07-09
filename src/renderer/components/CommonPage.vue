<template>
    <div class="ui celled grid">
        <div class="black row">
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
                <!--<div class="ui inverted labeled icon dropdown">
                                                            <i class="filter inverted icon"></i>
                                                            <span class="inverted text">All</span>
                                                            <div class="inverted menu">
                                                                <option class="item">All</option>
                                                                <option class="item">ModPack</option>
                                                                <option class="item">Servers</option>
                                                            </div>
                                                        </div>-->
            </div>
        </div>
        <div class="row">
            <div class="four wide middle aligned center aligned column">
                <div class="ui header segment">{{this.$store.state.auth.playerName}}</div>
                <!--<skin-view width="1200" height="400"></skin-view>-->
                <div class="ui segment">
                    <button class="ui icon button">
                        <i class="setting icon"></i>
                    </button>
                </div>
            </div>
            <div class="ten wide column">
                <div class="ui link cards">
                    <profile v-for="profile in profiles" :key="profile" :name="profile.name" :description="profile.description" :author="profile.author" :ping="profile.ping" :ip="profile.ip" :type="profile.type" @select="onSelect(profile)"></profile>
                </div>
                <!--<button class="ui huge button">Launch</button>-->
            </div>
        </div>
    </div>
</template>

<script>
import SkinView from './widget/SkinViewer'
import profile from './widget/Profile'
export default {
    data() {
        return {
            profiles: [
                {
                    name: 'new age',
                    author: 'ci010',
                    description: 'the new age pack',
                    type: 'modpack'
                },
                {
                    name: 'myminecraft',
                    ip: 'mc.crafter.me',
                    description: 'server motd',
                    ping: 100,
                    type: 'server'
                }
            ]
        }
    },
    mounted(e) {
        // $('.dropdown').dropdown({
        //     onChange: (value, text, $selectedItem) => {
        //     }
        // })
    },
    methods: {
        onSelect(event) {
        }
    },
    components: {
        SkinView, profile
    }
}
</script>
