<template>
    <div id="login" class="ui basic modal" style="padding:0 20% 0 20%;">
        <i class="close icon" v-if="this.$store.state.auth.authInfo !== undefined"></i>
        <div class="ui noselect" style="padding:15px">
            <h3 class="ui header segment center aligned ">
                <div class="content">
                    Minecraft
                </div>
            </h3>
            <form class="ui large form">
                <div class="ui segment">
                    <div id="authMode" class="ui labeled icon dropdown button">
                        <i class="world icon"></i>
                        <span class="text">{{$t(mode+'.name')}}</span>
                        <div class="menu">
                            <option class="item" v-for="item in modes" :key="item" :value="item">{{$t(item+'.name')}}</option>
                        </div>
                    </div>
                    <br>
                    <br>
                    <div id="accf" class="field">
                        <div class="ui left icon input">
                            <i class="user icon"></i>
                            <input id="acc" type="text" name="email" :placeholder="$t(mode+'.account')" v-on:keyup.enter="doLogin" v-model="account">
                        </div>
                    </div>
                    <div id="pswf" class="field">
                        <div class="ui left icon input">
                            <i class="lock icon"></i>
                            <input id="psw" type="password" name="password" :placeholder="$t(mode+'.password')" :disabled="disablePassword" v-on:keyup.enter="doLogin" v-model="password">
                        </div>
                    </div>
                    <div class="ui fluid large submit button" :class="{loading: logining}" v-on:click="doLogin">{{$t('login')}}</div>
                </div>
                <div class="ui error message"></div>
            </form>
            <div class="ui segment center aligned">
                <span class="ui text">
                    {{$t('signup.description')}}
                    <a class="ui blue label" href="#">{{$t('signup')}}</a>
                </span>
            </div>
        </div>
    </div>
</template>

<script>
import { mapGetters, mapMutations, mapState } from 'vuex'
import { VNode } from 'vue'

const arr = ['jiggle', 'shake', 'tada']
function randomShake() {
    return arr[Math.round(Math.random() * 3)]
}
let translating = false
let inited = false

export default {
    data: () => {
        return {
            logining: false,
            account: '',
            password: '',
        }
    },
    computed:
    {
        ...mapState('auth', ['history', 'clientToken', 'mode', 'modes']),
        ...mapGetters('auth', ['disablePassword'])
    },
    mounted() {
        const self = this
        this.$nextTick(() => {
            $('#authMode').dropdown({
                onChange: (value, text, $selectedItem) => {
                    self.$store.commit('auth/select', value)
                }
            })
            $('#login')
                .modal('setting', 'closable', false)
                .modal('refresh')
                .modal('setting', 'observeChanges', true)
                .modal({ blurring: true })
        })
    },
    methods: {
        show() {
            $('#login').modal('show')
        },
        doLogin(e) {
            if (this.account.length == 0) {
                if (translating) return
                translating = true
                $('#accf').transition({
                    animation: randomShake(),
                    onComplete: () => {
                        translating = false
                    }
                })
            }
            else if (this.password.length == 0 && this.mode != 'offline') {
                if (translating) return
                translating = true
                $('#pswf').transition({
                    animation: randomShake(),
                    onComplete: () => {
                        translating = false
                    }
                })
            }
            else {
                this.logining = true
                this.$store.dispatch('auth/login',
                    { account: this.account, password: this.password, mode: this.mode, clientToken: this.clientToken })
                    .then((result) => {
                        this.logining = false
                        this.$emit('logined')
                        this.$nextTick(() => $('#login').modal('hide'))
                    }, err => {
                        console.log(err)
                        this.logining = false
                        //TODO handle this
                    })
            }
        },
        ...mapMutations('auth', [
            'select'
        ])
    }
}
</script>
