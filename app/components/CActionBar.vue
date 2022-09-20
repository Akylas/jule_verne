<template>
    <GridLayout class="actionBar" columns="auto,*, auto" paddingLeft="5" paddingRight="5" :backgroundColor="backgroundColor">
        <StackLayout col="1" colSpan="3" verticalAlignment="center">
            <Label class="actionBarTitle" :visibility="!!title ? 'visible' : 'hidden'" textAlignment="left" :text="title || '' | uppercase" />
            <Label :visibility="!!subtitle ? 'visible' : 'collapse'" textAlignment="left" class="actionBarSubtitle" :text="subtitle" />
        </StackLayout>
        <Label col="1" v-if="!!showLogo && !title" fontSize="28" color="white" verticalAlignment="center" marginLeft="6" />
        <StackLayout col="0" orientation="horizontal">
            <slot name="left" />
            <MDButton variant="text" :visibility="menuIconVisibility" class="icon-btn" :text="menuIcon" @tap="onMenuIcon" />
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
    @Prop({
        default: null
    })
    public title: string;

    @Prop({ default: null })
    public subtitle: string;

    @Prop({ default: false, type: Boolean })
    public showMenuIcon: boolean;

    @Prop({ default: false, type: Boolean })
    public disableBackButton: boolean;
    @Prop({ type: String })
    public backgroundColor: string;

    // @Prop({ default: false })
    public canGoBack = false;

    @Prop({ default: true })
    public showLogo: boolean;
    @Prop({ default: false, type: Boolean })
    public modal: boolean;

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
        if (this.modal) {
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
