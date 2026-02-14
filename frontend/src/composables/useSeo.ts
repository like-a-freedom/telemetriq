import { useHead, useSeoMeta } from '@unhead/vue';
import { computed } from 'vue';
import { useRoute } from 'vue-router';

export interface SeoOptions {
    title?: string;
    description?: string;
    image?: string;
    url?: string;
}

const SITE_NAME = 'Telemetriq';
// Read SITE_URL from environment at build time. Vite exposes variables prefixed with `VITE_` to client code.
// Fallback order: import.meta.env.VITE_SITE_URL -> (import.meta.env).SITE_URL -> default.
const SITE_URL = ((import.meta.env.VITE_SITE_URL as string) || ((import.meta.env as any).SITE_URL as string) || 'https://telemetriq.app').replace(/\/$/, '');
const DEFAULT_DESCRIPTION = 'Create stunning sports telemetry overlay videos. Visualize GPS data, heart rate, speed, and elevation from GPX files on your workout videos.';
const DEFAULT_IMAGE = '/og-image.png';

export function useSeo(options: SeoOptions = {}) {
    const route = useRoute();

    const title = computed(() => {
        if (options.title) return `${options.title} | ${SITE_NAME}`;
        return `${SITE_NAME} — Sports Telemetry Overlay`;
    });

    const description = computed(() => options.description || DEFAULT_DESCRIPTION);
    const url = computed(() => options.url || `${SITE_URL}${route.path}`);
    const image = computed(() => options.image || `${SITE_URL}${DEFAULT_IMAGE}`);

    useHead({
        title: title,
        htmlAttrs: {
            lang: 'en',
        },
        link: [
            { rel: 'canonical', href: url },
        ],
        script: [
            {
                type: 'application/ld+json',
                innerHTML: JSON.stringify({
                    '@context': 'https://schema.org',
                    '@type': 'WebApplication',
                    name: SITE_NAME,
                    description: description.value,
                    url: SITE_URL,
                    applicationCategory: 'MultimediaApplication',
                    operatingSystem: 'Any (Web Browser)',
                    offers: {
                        '@type': 'Offer',
                        price: '0',
                        priceCurrency: 'USD',
                    },
                    featureList: [
                        'GPX telemetry visualization',
                        'Video overlay generation',
                        'WebGPU rendering',
                        'Customizable templates',
                        'Browser-based processing',
                    ],
                }),
            },
        ],
    });

    useSeoMeta({
        title: title,
        description: description,
        ogTitle: title,
        ogDescription: description,
        ogImage: image,
        ogUrl: url,
        ogSiteName: SITE_NAME,
        ogType: 'website',
        twitterCard: 'summary_large_image',
        twitterTitle: title,
        twitterDescription: description,
        twitterImage: image,
    });
}
