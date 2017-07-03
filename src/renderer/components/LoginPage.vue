<template>
    <div class="ui noselect">
        <h2 class="ui header segment center aligned ">
            <div class="content">
                Minecraft
            </div>
        </h2>
        <form class="ui large form">
            <div class="ui segment">
                <div class="ui labeled icon dropdown button">
                    <i class="world icon"></i>
                    <span class="text">Mojang</span>
                    <div class="menu">
                        <option class="item" v-for="item in modes" :value="item">{{item}}</option>
                    </div>
                </div>
                <br>
                <br>
                <div id="accf" class="field">
                    <div class="ui left icon input">
                        <i class="user icon"></i>
                        <input id="acc" type="text" name="email" :placeholder="auth.account" v-on:keyup.enter="doLogin">
                    </div>
                </div>
                <div id="pswf" class="field">
                    <div class="ui left icon input">
                        <i class="lock icon"></i>
                        <input id="psw" type="password" name="password" :placeholder="auth.password" :disabled="auth.disable" v-on:keyup.enter="doLogin">
                    </div>
                </div>
                <div class="ui fluid large submit button" v-on:click="doLogin">{{auth.login}}</div>
            </div>
            <div class="ui error message"></div>
        </form>
    
        <div class="ui segment center aligned ">
            New to us?
            <a href="#">Sign Up</a>
        </div>
    </div>
</template>
<style>
.noselect {
    -webkit-touch-callout: none;
    -webkit-user-select: none;
    -khtml-user-select: none;
    -moz-user-select: none;
    -ms-user-select: none;
    user-select: none;
}
</style>

<script>
const css = require('semantic/dist/semantic.min.css')
const ui = require('semantic/dist/semantic.min.js')

const { ipcRenderer } = require('electron')

var model = {
    modes: [
        'Offline',
        'Mojang'
    ],
    mode: 1,
    auth: {
        account: 'E-mail address',
        password: 'Password',
        login: 'Login',
        disable: false
    }
}
ipcRenderer.on('init', (event, args) => {

})

ipcRenderer.on('mode-update', (event, args) => {
    try {
        let id = args
        i18n.trans(id + '.account')
        i18n.trans(id + '.password')
        i18n.trans(id + '.login')
    } catch (error) {
    }
    if (args == 'offline')
        model.auth.disable = true
    else
        model.auth.disable = false
})

const arr = ['jiggle', 'shake', 'tada', 'bounce', 'pulse']
function randomShake() {
    return arr[Math.round(Math.random() * 5)]
}
let translating = false

export default {
    name: 'login-page',
    mounted: (e) => {
        this.acc = document.getElementById('acc')
        this.psw = document.getElementById('psw')
        $('.dropdown').dropdown({
            onChange: (value, text, $selectedItem) =>
                ipcRenderer.send('mode-update', value)
        })
    },
    methods: {
        doLogin: (e) => {
            if (this.acc.value.length == 0)
                $('#accf').transition(randomShake())
            else if (this.psw.value.length == 0 && !model.auth.disable)
                $('#pswf').transition(randomShake())
            else ipcRenderer.send('login', [this.acc.value, this.psw.value, model.mode])
        }
    },
    data: () => {
        return model
    }
}
</script>