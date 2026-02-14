import { createRouter, createWebHistory } from 'vue-router';

const routes = [
    {
        path: '/',
        name: 'upload',
        component: () => import('../views/UploadView.vue'),
        meta: {
            title: 'Upload Files — Telemetriq',
            description: 'Upload your GPX telemetry and video files to create sports overlay videos',
        },
    },
    {
        path: '/preview',
        name: 'preview',
        component: () => import('../views/PreviewView.vue'),
        meta: {
            title: 'Preview — Telemetriq',
            description: 'Preview and customize your telemetry overlay before processing',
        },
    },
    {
        path: '/processing',
        name: 'processing',
        component: () => import('../views/ProcessingView.vue'),
        meta: {
            title: 'Processing — Telemetriq',
            description: 'Your video is being processed with telemetry overlay',
        },
    },
    {
        path: '/result',
        name: 'result',
        component: () => import('../views/ResultView.vue'),
        meta: {
            title: 'Download Result — Telemetriq',
            description: 'Download your video with telemetry overlay',
        },
    },
];

const router = createRouter({
    history: createWebHistory(),
    routes,
});

export default router;
