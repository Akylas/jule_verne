<template>
    <Page ref="page" actionBarHidden @loaded="onLoaded">
        <Drawer ref="drawer" leftDrawerMode="slide" :leftClosedDrawerAllowDraging="false">
            <GridLayout ~leftDrawer rows="auto, *, auto" height="100%" :backgroundColor="backgroundColor" width="80%">
                <GridLayout padding="10" height="80" rows="auto, *" columns="auto, *">
                    <Label marginLeft="15" fontSize="20" :text="$t('browse') | titlecase" :color="textColor"/>
                </GridLayout>
                <CollectionView :items="menuItems" row="1" paddingTop="10" rowHeight="50" @tap="noop">
                    <v-template>
                        <GridLayout columns="50, *" class="menu" :active="item.activated" :rippleColor="accentColor" @tap="onNavItemTap(item.url)">
                            <Label col="0" class="menuIcon" :text="item.icon" verticalAlignment="center" />
                            <Label col="1" class="menuText" :text="item.title | titlecase" verticalAlignment="center" :active="item.activated" />
                        </GridLayout>
                    </v-template>
                </CollectionView>
                <StackLayout row="2" width="100%" padding="10">
                    <StackLayout class="menuInfos">
                        <Label :text="'App version: ' + (appVersion || '')" @longPress="switchDevMode" />
                    </StackLayout>
                </StackLayout>
            </GridLayout>
            <StackLayout ~mainContent>
                <Frame ref="innerFrame">
                    <Home />
                </Frame>
            </StackLayout>
        </Drawer>
    </Page>
</template>

<script lang="ts" src="./App.ts" />
