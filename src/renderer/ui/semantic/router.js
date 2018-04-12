import Vue from 'vue'
import { RouteConfig } from 'vue-router'

import SemanticUi from './Semantic'

import ProfileView from './components/home/ProfileView'
import CardView from './components/home/CardView'

import ResourcePackList from './components/home/ResourcePackList'
import GameSettings from './components/home/GameSettings'
import ModsList from './components/home/ModsList'
import MapsList from './components/home/MapsList'
import VersionView from './components/home/VersionView'
import LaunchSettings from './components/home/LaunchSettings'

import CardsButtonGroup from './components/home/CardsButtonGroup'
import ProfileSelectedButtonGroup from './components/home/ProfileSelectedButtonGroup'

import MarketView from './components/market/MarketView'
import Curseforge from './components/market/Curseforge'
import CurseforgeProjects from './components/market/CurseforgeProjects'
import CurseforgeProject from './components/market/CurseforgeProject'
import Mcmodcn from './components/market/McmodCn'
import McmodcnProject from './components/market/McModCnProject'
import MarketButtonGroup from './components/market/MarketButtonGroup'

export default {
    path: '/semantic',
    name: 'semantic',
    redirect: '/semantic/profile',
    component: SemanticUi,
    children: [
        {
            path: 'profile',
            name: 'profile',
            components: {
                default: CardView,
                buttons: CardsButtonGroup,
            },
        },
        {
            path: 'profile/:id',
            components: {
                default: ProfileView,
                buttons: ProfileSelectedButtonGroup,
            },
            props: {
                default: true,
                buttons: false,
            },
            children: [
                {
                    path: '',
                    redirect: 'version',
                },
                {
                    path: 'resourcepack',
                    component: ResourcePackList,
                },
                {
                    path: 'setting',
                    component: GameSettings,
                },
                {
                    path: 'mod',
                    component: ModsList,
                },
                {
                    path: 'version',
                    component: VersionView,
                },
                {
                    path: 'map',
                    component: MapsList,
                },
                {
                    path: 'launchsetting',
                    component: LaunchSettings,
                },
            ],
        },
        {
            path: 'market',
            name: 'market',
            components: { buttons: MarketButtonGroup, default: MarketView },
        },
        {
            path: 'market/curseforge',
            name: 'market/curseforge',
            components: { buttons: MarketButtonGroup, default: Curseforge },
        },
        {
            path: 'market/curseforge/:project',
            components: { buttons: MarketButtonGroup, default: CurseforgeProjects },
            props: { default: true, buttons: false },
        },
        {
            path: 'market/curseforge/:project/:id',
            components: { buttons: MarketButtonGroup, default: CurseforgeProject },
            props: { default: true, buttons: false },
        },
        {
            path: 'market/mcmodcn',
            name: 'market/mcmodcn',
            components: { buttons: MarketButtonGroup, default: Mcmodcn },
        },
        {
            path: 'market/mcmodcn/:id',
            components: { buttons: MarketButtonGroup, default: McmodcnProject },
            props: { default: true, buttons: false },
        },
    ],
}
