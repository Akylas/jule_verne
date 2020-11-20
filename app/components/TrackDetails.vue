<template>
    <Page ref="page" :navigateUrl="navigateUrl" @navigatedTo="onNavigatedTo" @loaded="onLoaded">
        <GridLayout backgroundColor="white" rows="auto,150,*">
            <CActionBar :title="$t('details')" showMenuIcon>
                <MDButton v-show="editable" variant="text" class="icon-btn" :text="isEditing ? 'mdi-content-save' : 'mdi-pencil'" @tap="isEditing ? save() : (isEditing = !isEditing)" />

                <MDButton v-show="isEditing" variant="text" class="icon-btn" :text="'mdi-close'" @tap="leaveEditing()" />
            </CActionBar>
            <GridLayout row="1" @layoutChanged="onMapLayoutChange">
                <MapComponent ref="mapComp" height="100%" width="100%" :tracks="[track]" @mapReady="onMapReady" :showFiltered="devMode" :locationEnabled="false" />
            </GridLayout>
            <CollectionView row="2" :items="dataItems">
                <v-template>
                    <GridLayout height="60" columns="auto,*" :backgroundColor="'white'">
                        <CanvasLabel col="1" paddingLeft="16" fontSize="14" class="robotoMedium" borderBottomWidth="1" :borderBottomColor="borderColor" backgroundColor="transparent">
                            <CSpan :text="icon(item)" color="gray" fontSize="24" verticalAlignment="center" :fontFamily="mdiFontFamily" />
                            <CSpan :color="textColor" paddingLeft="50" fontSize="15" verticalAlignment="center" :text="item.properties.name" />
                            <Circle
                                strokeWidth="2"
                                paintStyle="fill_and_stroke"
                                :strokeColor="item.properties.color"
                                :fillColor="fillColor(item)"
                                radius="15"
                                antiAlias
                                horizontalAlignment="right"
                                verticalAlignment="middle"
                                width="50"
                            />
                        </CanvasLabel>
                    </GridLayout>
                </v-template>
            </CollectionView>
        </GridLayout>
    </Page>
</template>

<script lang="ts" src="./TrackDetails.ts" />
