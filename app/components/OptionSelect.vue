<template>
    <!-- <Frame> -->
    <!-- <Page actionBarHidden ref="page" ios:barStyle="light" :navigationBarColor="darkColor" :statusBarColor="darkColor"> -->
    <StackLayout :height="height">
        <GridLayout rows="auto,*,auto" margin="12 20 0 20">
            <Label row="0" paddingBottom="15" fontWeight="800" :text="title | capitalize" verticalAlignment="center" textWrap />
            <CollectionView row="1" :items="options" @itemTap="onItemTap">
                <v-template>
                    <ListItem :title="item.title" :subtitle="item.subtitle" @tap="onItemTap(item)" />
                </v-template>
            </CollectionView>
            <GridLayout rows="auto" columns="*,auto,auto" row="2" horizontalAlignment="right" orientation="horizontal" borderTopColor="#EEEEEE" borderTopWidth="1" width="100%">
                <MDButton row="0" col="2" variant="text" class="buttontext" :text="$t('cancel')" @tap="close()" />
            </GridLayout>
        </GridLayout>
    </StackLayout>
    <!-- </Page> -->
    <!-- </Frame> -->
</template>

<script lang="ts" src="./OptionSelect.ts" />
