<template>
    <GridLayout class="actionBar" columns="auto,*, auto" paddingLeft="5" paddingRight="5">
        <StackLayout :col="textAlignment === 'center' ? 0 : 1" colSpan="3" verticalAlignment="center">
            <Label class="actionBarTitle" :visibility="!!title ? 'visible' : 'hidden'" :textAlignment="textAlignment" :text="title || '' | titlecase" />
            <Label :visibility="!!subtitle ? 'visible' : 'collapse'" :textAlignment="textAlignment" class="actionBarSubtitle" :text="subtitle" />
        </StackLayout>
        <Label col="1" v-if="!!showLogo && !title" fontSize="28" color="white" verticalAlignment="center" marginLeft="6" />
            <slot col="1" name="center" />
        <StackLayout col="0" orientation="horizontal">
            <slot name="left" />
            <MDButton variant="text" :visibility="menuIconVisibility" class="actionBarButton" :text="menuIcon" @tap="onMenuIcon" />
        </StackLayout>
        <StackLayout col="2" orientation="horizontal">
            <slot />
        </StackLayout>
    </GridLayout>
</template>

<script lang="ts">
import { Component, Prop } from 'vue-property-decorator';
import BaseVueComponent from './BaseVueComponent';

@Component({})
export default class ActionBar extends BaseVueComponent {
    @Prop({ default: null }) title: string;
    @Prop({ default: null }) subtitle: string;
    @Prop({ default: false, type: Boolean }) showMenuIcon: boolean;
    @Prop({ default: 'left', type: String }) textAlignment: string;
    @Prop({ default: false, type: Boolean }) disableBackButton: boolean;
    @Prop({ default: true }) showLogo: boolean;
    @Prop({ default: false, type: Boolean }) modal: boolean;
    @Prop({ type: Function }) goBack: Function;

    public canGoBack = false;

    get menuIcon() {
        if (this.modal) {
            return 'mdi-close';
        }
        if (this.canGoBack) {
            return __IOS__ ? 'mdi-chevron-left' : 'mdi-arrow-left';
        }
        return 'mdi-menu';
    }
    get menuIconVisible() {
        return (this.canGoBack && !this.disableBackButton) || this.showMenuIcon;
    }
    get menuIconVisibility() {
        return this.menuIconVisible ? 'visible' : 'collapsed';
    }

    mounted() {
        setTimeout(() => {
            this.canGoBack = this.modal || this.$canGoBack();
        }, 0);
    }
    onMenuIcon() {
        if (this.goBack) {
            this.goBack();
        } else if (this.modal) {
            this.$modal.close();
        } else {
            if (this.$canGoBack()) {
                this.$navigateBack();
            } else {
                this.$openDrawer();
            }
        }
    }
}
</script>
