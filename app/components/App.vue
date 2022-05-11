<template>
    <StackLayout ref="page" actionBarHidden>
        <GridLayout v-if="message" height="60" backgroundColor="blue" columns="*,auto,auto" rows="auto,*" padding="5">
            <Label :text="message.title" color="white" fontSize="14" fontWeight="bold" lineBreak="end" verticalTextAlignment="center" />
            <Label col="1" :text="message.message" color="white" fontSize="10" textAlign="right" verticalTextAlignment="center" />
            <GridLayout row="1" colSpan="2" orientation="horizontal" columns="*, auto">
                <MDProgress v-if="message.progress !== undefined" :value="message.progress" verticalAlignment="center" color="white" />
                <MDButton fontSize="12" padding="2" variant="text" v-if="message.action" :text="message.action.text" color="white" @tap="message.action.callback" col="1" />
            </GridLayout>
        </GridLayout>
        <Frame>
            <Home />
        </Frame>
    </StackLayout>
</template>
<script lang="ts">
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
    message: {
        title: string;
        message: string;
        progress: number;
        action?: {
            text: string;
            callback: Function;
        };
    } = null;
    mounted() {
        super.mounted();
        on('appMessage', this.setMessage, this);
        on('appMessageUpdate', this.updateMessage, this);
    }
    updateMessage(event) {
        if (this.message) {
            // console.log('updateMessage', JSON.stringify(event.data));
            this.message = Object.assign(this.message, event.data);
        }
    }
    setMessage(event) {
        this.message = event.data;
    }
    destroyed() {
        super.destroyed();
        off('appMessage', this.setMessage, this);
        off('appMessageUpdate', this.updateMessage, this);
    }
}
</script>
