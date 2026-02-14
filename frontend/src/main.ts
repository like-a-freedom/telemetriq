import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { createHead } from '@unhead/vue/client';
import App from './App.vue';
import router from './router';
import './style.css';
import { useFilesStore, useProcessingStore, useSettingsStore, useSyncStore } from './stores';

const app = createApp(App);
const pinia = createPinia();
const head = createHead();

app.use(pinia);
app.use(router);
app.use(head);
app.mount('#app');

// Expose stores for E2E testing when explicitly enabled
if (import.meta.env.DEV && new URLSearchParams(window.location.search).has('e2e')) {
    (window as unknown as { __e2eStores?: unknown }).__e2eStores = {
        files: useFilesStore(pinia),
        sync: useSyncStore(pinia),
        processing: useProcessingStore(pinia),
        settings: useSettingsStore(pinia),
    };
}
