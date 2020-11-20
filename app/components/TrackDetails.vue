<template>
    <Page ref="page" :navigateUrl="navigateUrl" @navigatedTo="onNavigatedTo" @loaded="onLoaded">
        <GridLayout backgroundColor="white" rows="auto,250,*">
            <CActionBar :title="$t('details')" showMenuIcon>
                <MDButton v-show="editable" variant="text" class="icon-btn" :text="isEditing ? 'mdi-content-save' : 'mdi-pencil'" @tap="isEditing ? save() : (isEditing = !isEditing)" />

                <MDButton v-show="isEditing" variant="text" class="icon-btn" :text="'mdi-close'" @tap="leaveEditing()" />
            </CActionBar>
            <GridLayout row="1" @layoutChanged="onMapLayoutChange">
                <MapComponent ref="mapComp" height="100%" width="100%" :tracks="[track]" @mapReady="onMapReady" :showFiltered="devMode" :locationEnabled="false" />
            </GridLayout>
            <ScrollView row="2">
                <StackLayout>
                    <StackLayout v-show="isEditing">
                        <MDTextField class="session-details-input" :hint="$t('name')" v-model="editableName" />
                        <MDTextField class="session-details-input" :hint="$t('description')" v-model="editableDesc" />
                    </StackLayout>
                </StackLayout>
            </ScrollView>
        </GridLayout>
    </Page>
</template>

<script lang="ts" src="./TrackDetails.ts" />
