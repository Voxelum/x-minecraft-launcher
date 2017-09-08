<template>
    <div class="ui basic modal" style="padding:0 20% 0 20%;">
        <i class="close icon" v-if="this.$store.state.auth.authInfo !== undefined"></i>
        <div class="ui noselect" style="padding:15px">
            <h3 class="ui inverted header segment center aligned ">
                <div class="content">
                    Minecraft
                </div>
            </h3>
            <form class="ui large form" :class="{error:error!==''}">
                <div class="ui inverted segment">
                    <div class=" field">
                        <div id="authMode" class="ui labeled icon dropdown inverted basic button">
                            <i class="world icon"></i>
                            <span class="text">{{$t(mode+'.name')}}</span>
                            <div class="menu">
                                <option class="item" v-for="item in modes" :key="item" :value="item">{{$t(`${item}.name`)}}</option>
                            </div>
                        </div>
                    </div>
                    <div id="accf" class="ui field">
                        <div class="ui left icon inverted input">
                            <i class="user icon"></i>
                            <div id='accd' class="ui floating dropdown">
                                <div class="menu" style="width:350px">
                                    <div class="item" :id="'acc_'+index" v-for="(h,index) of history" :key="h" :class="{selected:selecting===index }" @click="updateAccount(h)" @keypress.enter="updateAccount(h)">{{h}}</div>
                                </div>
                            </div>
                            <input id="acc" type="text" name="email" :placeholder="$t(`${mode}.account`)" @click="handleAccount" v-on:keyup="handleAccount" v-model="account">
                        </div>
                    </div>
                    <div id="pswf" class="field">
                        <div class="ui left icon inverted input">
                            <i class="lock icon"></i>
                            <input id="psw" type="password" name="password" :placeholder="$t(`${mode}.password`)" :disabled="disablePassword" v-on:keyup.enter="doLogin" v-model="password">
                        </div>
                    </div>
                    <div class="ui fluid large submit basic button inverted" :class="{loading: logining}" v-on:click="doLogin">{{$t('login')}}</div>
                    <br>
                </div>
                <div class="ui error message">
                    {{$t(error)}}
                </div>
            </form>
            <div class="ui inverted segment center aligned">
                <span class="ui text">
                    {{$t('signup.description')}}

                    <a class="ui" href="#">{{$t('user.signup')}}</a>
                </span>
            </div>
        </div>
    </div>
</template>

<script>
import { mapGetters, mapMutations, mapState } from 'vuex'

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
            error: '',
            account: '',
            password: '',
            selecting: 0,
        }
    },
    computed: {
        ...mapGetters('auth', ['disablePassword', 'history', 'mode', 'modes'])
    },
    mounted() {
        const self = this
        $('#authMode').dropdown({
            onChange: (value, text, $selectedItem) => {
                self.$store.commit('auth/select', value)
            }
        })
        $('#accd').dropdown({})
        $(this.$el)
            .modal('setting', 'closable', false)
            .modal('refresh')
            .modal({ blurring: true })
    },
    methods: {
        updateAccount(acc) {
            this.account = acc;
        },
        show() {
            $(this.$el).modal('show')
        },
        handleAccount(event) {
            if (this.account === '' && event.key === 'Backspace') {
                $('#accd').dropdown('hide'); return
            }
            if (event.key === 'ArrowDown') {
                this.selecting = Math.max(0, this.selecting - 1)
            } else if (event.key === 'ArrowUp') {
                this.selecting = Math.min(history.length - 1, this.selecting + 1)
            } else if (event.key === 'Enter') {
                if ($('#accd').dropdown('is visible')) {
                    this.account = document.getElementById(`acc_${this.selecting}`).innerText;
                    $('#accd').dropdown('hide')
                } else {
                    this.doLogin()
                }
            } else if (event.key === 'Tab') {
                $('#accd').dropdown('hide')
            } else {
                $('#accd').dropdown('show')
            }
        },
        doLogin() {
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
                    {
                        account: this.account, password: this.password,
                        mode: this.mode, clientToken: this.clientToken
                    })
                    .then((result) => {
                        this.logining = false
                        this.$emit('login')
                        this.error = '';
                        this.$nextTick(() => $(this.$el).modal('hide'))
                    }, err => {
                        this.logining = false
                        this.error = err.message;
                    })
            }
        },
        ...mapMutations('auth', [
            'select'
        ])
    }
}
</script>
