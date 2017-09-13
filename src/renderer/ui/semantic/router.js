import Vue from 'vue'
import { RouteConfig } from 'vue-router'

import SemanticUi from './Semantic'
import ModpackView from './components/ModpackView'
import ServerView from './components/ServerView'
import CardView from './components/CardView'
import MarketView from './components/MarketView'

export default {
    path: '/semantic',
    name: 'semantic',
    redirect: '/semantic/cards',
    component: SemanticUi,
    children: [
        {
            path: 'cards',
            name: 'cards',
            component: CardView,
        },
        {
            path: 'modpack/:id',
            name: 'modpack',
            component: ModpackView,
        },
        {
            path: 'server/:id',
            name: 'server',
            component: ServerView,
        },
        {
            path: 'market',
            name: 'market',
            component: MarketView,
        },
    ],
}
