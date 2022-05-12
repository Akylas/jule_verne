<template>
    <StackLayout ref="page" actionBarHidden>
        <Pager v-if="showMessages" height="60" :items="messages" backgroundColor="blue">
            <v-template>
                <GridLayout columns="*,auto,auto" rows="auto,*" padding="5" width="100%" height="100%">
                    <Label :text="item.title" color="white" fontSize="14" fontWeight="bold" lineBreak="end" verticalTextAlignment="center" />
                    <Label col="1" :text="item.message" color="white" fontSize="10" textAlign="right" verticalTextAlignment="center" />
                    <GridLayout row="1" colSpan="2" orientation="horizontal" columns="*, auto">
                        <MDProgress v-show="item.progress !== undefined" :value="item.progress" verticalAlignment="center" color="white" />
                        <MDButton fontSize="12" padding="2" variant="text" v-show="item.action" :text="item.action.text" color="white" @tap="onButtonTap(item)" col="1" />
                    </GridLayout>
                </GridLayout>
            </v-template>
        </Pager>
        <Frame>
            <Home />
        </Frame>
    </StackLayout>
</template>
<script lang="ts">
import { ObservableArray } from '@akylas/nativescript';
import { Component } from 'vue-property-decorator';
import BaseVueComponent from '~/components/BaseVueComponent';
import Home from '~/components/Home';
import { off, on } from '~/utils';
@Component({
    components: {
        Home
    }
})
export default class App extends BaseVueComponent {
    messages: ObservableArray<{
        id: number;
        title: string;
        message: string;
        progress: number;
        action?: {
            text: string;
            callback: Function;
        };
    }> = new ObservableArray([]);

    showMessages = false;
    mounted() {
        super.mounted();
        on('appMessage', this.setMessage, this);
        on('appMessageUpdate', this.updateMessage, this);
        on('appMessageRemove', this.removeMessage, this);
    }
    onButtonTap(item) {
        console.log('onButtonTap', item);
        item.action?.callback?.();
    }
    updateMessage(event) {
        try {
            const update = event.data;
            const currentMessageIndex = this.messages.findIndex((d) => d.id === update.id);
            if (currentMessageIndex >= 0) {
                this.messages.setItem(currentMessageIndex, Object.assign(this.messages.getItem(currentMessageIndex), update));
            }
        } catch (error) {
            console.error(error);
        }
    }
    setMessage(event) {
        try {
            const message = event.data;
            const currentMessageIndex = this.messages.findIndex((d) => d.id === message.id);
            if (currentMessageIndex >= 0) {
                this.messages.setItem(currentMessageIndex, message);
            } else {
                this.messages.push(message);
            }
            this.showMessages = this.messages.length > 0;
        } catch (error) {
            console.error(error);
        }
    }
    removeMessage(event) {
        try {
            const message = event.data;
            const currentMessageIndex = this.messages.findIndex((d) => d.id === message.id);
            if (currentMessageIndex >= 0) {
                this.messages.splice(currentMessageIndex, 1);
            }
            this.showMessages = this.messages.length > 0;
        } catch (error) {
            console.error(error);
        }
    }
    destroyed() {
        super.destroyed();
        off('appMessage', this.setMessage, this);
        off('appMessageUpdate', this.updateMessage, this);
        off('appMessageRemove', this.removeMessage, this);
    }
}
</script>
