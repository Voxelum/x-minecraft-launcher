<template>
    <div class="ui basic modal" style="padding: 0 20% 0 20%">
        <i class="close icon" v-if="this.$store.state.user.auth !== undefined"></i>
        <div class="ui noselect" style="padding:15px">
            <h3 class="ui inverted header segment center aligned ">
                <div class="content">
                    Minecraft
                </div>
            </h3>
            <form class="ui large form" :class="{error:error!==''}">
                <div class="ui inverted segment">
                    <div class=" field">
                        <div ref="authMod" class="ui labeled icon dropdown inverted basic button">
                            <i class="world icon"></i>
                            <span class="text">{{$t(mode+'.name')}}</span>
                            <div class="menu">
                                <option class="item" v-for="item in modes" :key="item" :value="item">{{$t(`${item}.name`)}}</option>
                            </div>
                        </div>
                    </div>
                    <div ref="accountField" class="ui field">
                        <div class="ui left icon inverted input">
                            <i class="user icon"></i>
                            <div ref="accountDropdown" class="ui floating dropdown">
                                <div class="fluid menu">
                                    <div style="width:100%" class="item" :id="'acc_'+index" v-for="(h,index) of history" :key="h" :class="{selected:selecting===index }" @click="updateAccount(h)" @keypress.enter="updateAccount(h)">{{h}}</div>
                                </div>
                            </div>
                            <input type="text" name="email" :placeholder="$t(`${mode}.account`)" @click="handleAccount" v-on:keyup="handleAccount" v-model="account">
                        </div>
                    </div>
                    <div ref="passwordField" class="field">
                        <div class="ui left icon inverted input">
                            <i class="lock icon"></i>
                            <input type="password" name="password" :placeholder="$t(`${mode}.password`)" :disabled="mode==='offline'" v-on:keyup.enter="doLogin" v-model="password">
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
                    <a class="ui" href="#/external/https://minecraft.net/en-us/store/minecraft/#register">{{$t('user.signup')}}</a>
                </span>
            </div>
        </div>
    </div>
</template>

<script>
import vuex from 'vuex'
import { remote } from 'electron'

export default {
    data: () => ({
        logining: false,
        error: '',
        account: '',
        password: '',
        selecting: 0,
        animations: ['jiggle', 'shake', 'tada'],
    }),
    computed: {
        ...vuex.mapGetters('user', ['history', 'mode', 'modes', 'logined']),
    },
    watch: {
        mode() {
            console.log('mode change!');
        }
    },
    mounted() {
        const self = this
        $(this.$refs.authMod).dropdown({
            onChange: (value, text, $selectedItem) => {
                self.selectLoginMode(value)
            },
        })
        $(this.$refs.accountDropdown).dropdown()
        $(this.$el).modal({
            closable: false,
            onHide($element) {
                return true;
            },
            blurring: true,
        })
        if (!this.logined) this.show()
    },
    methods: {
        ...vuex.mapActions('user', ['selectLoginMode', 'login']),
        updateAccount(account) {
            this.account = account;
        },
        show() {
            $(this.$el).modal('show')
        },
        handleAccount(event) {
            if (this.account === '' && event.key === 'Backspace') {
                $(this.$refs.accountDropdown).dropdown('hide'); return
            }
            if (event.key === 'ArrowDown') {
                this.selecting = Math.max(0, this.selecting - 1)
            } else if (event.key === 'ArrowUp') {
                this.selecting = Math.min(history.length - 1, this.selecting + 1)
            } else if (event.key === 'Enter') {
                if ($(this.$refs.accountDropdown).dropdown('is visible')) {
                    this.account = document.getElementById(`acc_${this.selecting}`).innerText;
                    $(this.$refs.accountDropdown).dropdown('hide')
                } else this.doLogin()
            } else if (event.key === 'Tab') {
                $(this.$refs.accountDropdown).dropdown('hide')
            } else {
                $(this.$refs.accountDropdown).dropdown('show')
            }
        },
        shake(ref) {
            if (this.translating) return
            this.translating = true
            const self = this;
            const animation = this.animations[Math.round(Math.random() * 3)]
            $(ref).transition({
                animation,
                onComplete: () => { self.translating = false }
            })
        },
        doLogin() {
            if (this.account.length === 0) this.shake(this.$refs.accountField)
            else if (this.password.length === 0 && this.mode !== 'offline') {
                this.shake(this.$refs.passwordField)
            } else {
                this.logining = true
                this.$store.dispatch('user/login', {
                    account: this.account,
                    password: this.password,
                }).then((result) => {
                    this.logining = false
                    this.$emit('login')
                    this.error = '';
                    this.$nextTick(() => $(this.$el).modal('hide'))
                }, (err) => {
                    this.logining = false
                    this.error = this.$t(err.message);
                });
            }
        },
    }
}
</script>

<style>
.fluid.menu {
    width: 352px;
}
</style>
