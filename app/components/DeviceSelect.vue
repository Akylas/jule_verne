<template>
    <Frame id="insideModal">
        <Page id="deviceSelectPage" actionBarHidden ref="page" ios:barStyle="light">
            <StackLayout height="100%">
                <CActionBar modal :title="$t('pairing')" :showMenuIcon="false" />
                <GridLayout rows="auto,*,50">
                    <GridLayout class="themedBack" columns="*,auto" row="0" paddingLeft="20%" paddingRight="20%">
                        <Label col="0" class="robotoMedium" fontWeight="800" :text="title | capitalize" verticalAlignment="center" textWrap />
                        <MDActivityIndicator col="1" class="activity-indicator" :busy="scanning" />
                    </GridLayout>
                    <CollectionView row="1" :items="devices" rowHeight="50">
                        <v-template>
                            <ListItem :rightValue="itemRightValue(item)" :title="item.localName || $tc('unknown_device')" @tap="onItemTap(item, $event)" />
                        </v-template>
                    </CollectionView>
                    <StackLayout class="themedBack" row="2" horizontalAlignment="right" orientation="horizontal" width="100%">
                        <MDButton variant="text" height="100%" class="buttontextwhite" :text="$t('cancel')" @tap="close()" verticalAlignment="center" />
                        <MDButton
                            variant="text"
                            height="100%"
                            class="buttontextwhite"
                            :visibility="scanning ? 'collapsed' : 'visible'"
                            :text="$t('scan')"
                            @tap="startScan()"
                            verticalAlignment="center"
                        />
                    </StackLayout>
                </GridLayout>
            </StackLayout>
        </Page>
    </Frame>
</template>

<script lang="ts" src="./DeviceSelect.ts" />
