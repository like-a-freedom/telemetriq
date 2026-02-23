import { useHead, useSeoMeta } from '@unhead/vue';
import { computed } from 'vue';
import { useRoute } from 'vue-router';

export interface SeoOptions {
    title?: string;
    description?: string;
    image?: string;
    url?: string;
}

interface WindowWithSiteUrl extends Window {
    __SITE_URL__?: string;
}

const SITE_NAME = 'Telemetriq';

/** Get site URL from runtime or build-time environment */
function runtimeSiteUrl(): string | null {
    try {
        // Safe type guard for window.__SITE_URL__
        const win = window as WindowWithSiteUrl;
        const runtimeValue = win.__SITE_URL__;
        if (typeof runtimeValue === 'string') {
            return runtimeValue.replace(/\/$/, '');
        }
    } catch {
        // Not in browser environment
    }
    return null;
}

const SITE_URL = (
    runtimeSiteUrl()
    || (import.meta.env.VITE_SITE_URL as string | undefined)
    || (import.meta.env as { SITE_URL?: string }).SITE_URL
    || 'https://telemetriq.app'
).replace(/\/$/, '');

const DEFAULT_DESCRIPTION = 'Create stunning sports telemetry overlay videos. Visualize GPS data, heart rate, speed, and elevation from GPX files on your workout videos.';
const DEFAULT_IMAGE = '/og-image.png';

export function useSeo(options: SeoOptions = {}): void {
    const route = useRoute();

    const title = computed(() => {
        if (options.title) {
            return `${options.title} | ${SITE_NAME}`;
        }
        return `${SITE_NAME} — Sports Telemetry Overlay`;
    });

    const description = computed(() => options.description || DEFAULT_DESCRIPTION);
    const url = computed(() => options.url || `${SITE_URL}${route.path}`);
    const image = computed(() => options.image || `${SITE_URL}${DEFAULT_IMAGE}`);

    useHead({
        title,
        htmlAttrs: { lang: 'en' },
        link: [{ rel: 'canonical', href: url }],
        script: [{
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
        }],
    });

    useSeoMeta({
        title,
        description,
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
