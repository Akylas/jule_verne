<template>
    <Page ref="page" :navigateUrl="navigateUrl" @navigatedTo="onNavigatedTo" @loaded="onLoaded">
        <GridLayout rows="auto,250,*">
            <CActionBar :title="$t('details')" showMenuIcon>
                <MDButton v-show="editable" variant="text" class="icon-btn" :text="isEditing ? 'mdi-content-save' : 'mdi-pencil'" @tap="isEditing ? save() : (isEditing = !isEditing)" />

                <MDButton v-show="isEditing" variant="text" class="icon-btn" :text="'mdi-close'" @tap="leaveEditing()" />
            </CActionBar>
            <GridLayout row="1" @layoutChanged="onMapLayoutChange">
                <MapComponent ref="mapComp" height="100%" width="100%" :tracks="[track]" @mapReady="onMapReady" :showFiltered="devMode" :locationEnabled="false" />
            </GridLayout>
            <TabView row="2" :androidSelectedTabHighlightColor="accentColor">
                <TabViewItem title="Items">
                    <GridLayout>
                        <CollectionView :items="dataItems" rowHeight="60">
                            <v-template>
                                <CanvasLabel
                                    width="100%"
                                    height="100%"
                                    paddingLeft="16"
                                    fontSize="14"
                                    class="robotoMedium"
                                    borderBottomWidth="1"
                                    :borderBottomColor="borderColor"
                                    backgroundColor="transparent"
                                >
                                    <CSpan :text="icon(item)" color="gray" fontSize="24" verticalAlignment="center" :fontFamily="mdiFontFamily" width="24"/>
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
                                        width="80"
                                    />
                                </CanvasLabel>
                            </v-template>
                        </CollectionView>
                    </GridLayout>
                </TabViewItem>
                <TabViewItem title="Editor">
                    <GridLayout>
                        <Editor :track="track" />
                    </GridLayout>
                </TabViewItem>
            </TabView>
        </GridLayout>
    </Page>
</template>

<script lang="ts" src="./TrackDetails.ts" />
