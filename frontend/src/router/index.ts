import { createRouter, createWebHistory } from 'vue-router';

const routes = [
    {
        path: '/',
        name: 'upload',
        component: () => import('../views/UploadView.vue'),
    },
    {
        path: '/preview',
        name: 'preview',
        component: () => import('../views/PreviewView.vue'),
    },
    {
        path: '/processing',
        name: 'processing',
        component: () => import('../views/ProcessingView.vue'),
    },
    {
        path: '/result',
        name: 'result',
        component: () => import('../views/ResultView.vue'),
    },
];

const router = createRouter({
    history: createWebHistory(),
    routes,
});

export default router;
