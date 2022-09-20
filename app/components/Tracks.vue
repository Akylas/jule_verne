<template>
    <Page ref="page" id="history" :navigateUrl="navigateUrl" @navigatingTo="onNavigatingTo">
        <GridLayout rows="auto,*">
            <CActionBar :title="title" :showMenuIcon="!inSelection" :disableBackButton="inSelection">
                <StackLayout verticalAlignment="center" orientation="horizontal">
                    <!-- <MDButton variant="text" class="icon-btn" :text="'mdi-plus'" @tap="createTrack" v-if="!inSelection" /> -->
                    <!-- <MDButton variant="text" class="icon-btn" :text="'mdi-file-import'" @tap="importTrace" v-if="!inSelection" /> -->
                    <!-- <MDButton v-show="inSelection" variant="text" class="icon-btn" :text="'mdi-delete'" @tap="deleteSelectedSessions" /> -->
                </StackLayout>
                <MDButton v-if="inSelection" slot="left" variant="text" class="icon-btn" :text="'mdi-close'" @tap="unselectAllSessions" />
            </CActionBar>
            <CollectionView ref="collectionView" row="1" :items="dataItems" rowHeight="50">
                <v-template>
                    <ListItem
                        showChecked="true"
                        :title="itemTitle(item)"
                        :subtitle="itemSubtitle(item)"
                        :checked="item.checked"
                        :selected="isTrackSelected(item)"
                        :date="item.name && item.startTime | date('L LT')"
                        @tap="onItemTap(item, $event)"
                        @checkedChange="onTrackChecked(item, $event)"
                        @longPress="onItemLongPress(item, $event)"
                    />
                </v-template>
            </CollectionView>
        </GridLayout>
    </Page>
</template>

<script lang="ts" src="./Tracks.ts" />
