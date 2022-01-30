<template>
    <Page ref="page" actionBarHidden @loaded="onLoaded" @navigatedTo="onNavigatedTo">
        <Drawer ref="drawer" leftDrawerMode="slide" :leftClosedDrawerAllowDraging="false" height="100%">
            <GridLayout ~leftDrawer rows="auto, *, auto" height="100%" :backgroundColor="backgroundColor" width="80%">
                <GridLayout padding="10" height="80" rows="auto, *" columns="auto, *">
                    <Label marginLeft="15" fontSize="20" :text="$t('menu') | titlecase" :color="textColor" />
                </GridLayout>
                <CollectionView :items="menuItems" row="1" paddingTop="10" rowHeight="50" @tap="noop">
                    <v-template>
                        <GridLayout columns="50, *" class="menu" :active="item.activated" :rippleColor="accentColor" @tap="onNavItemTap(item)">
                            <Label col="0" class="menuIcon" :text="item.icon" verticalAlignment="center" />
                            <Label col="1" class="menuText" :text="item.title | titlecase" verticalAlignment="center" :active="item.activated" />
                        </GridLayout>
                    </v-template>
                </CollectionView>
                <StackLayout row="2" width="100%" padding="10">
                    <Label @longPress="switchDevMode" textWrap textAlignment="center">
                        <Span :text="'Glasses data version: ' + (glassesDataUpdateDate ? date(glassesDataUpdateDate, 'lll') : '')" />
                        <Span :text="'\n' + 'Map data version: ' + (mapDataUpdateDate ? date(mapDataUpdateDate, 'lll') : '')" />
                        <Span :text="'\n' + 'GeoJSON version: ' + (geojsonDataUpdateDate ? date(geojsonDataUpdateDate, 'lll') : '')" />
                        <Span :text="'\n' + 'App version: ' + (appVersion || '')" />
                    </Label>
                </StackLayout>
            </GridLayout>
            <GridLayout ~mainContent height="100%">
                <Frame ref="innerFrame">
                    <Home />
                </Frame>
            </GridLayout>
        </Drawer>
    </Page>
</template>

<script lang="ts" src="./App.ts" />
