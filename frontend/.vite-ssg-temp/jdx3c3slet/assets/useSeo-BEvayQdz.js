import { useHead, useSeoMeta } from '@unhead/vue';
import { computed } from 'vue';
import { useRoute } from 'vue-router';

const SITE_NAME = "Telemetriq";
const SITE_URL = "https://telemetriq.app";
const DEFAULT_DESCRIPTION = "Create stunning sports telemetry overlay videos. Visualize GPS data, heart rate, speed, and elevation from GPX files on your workout videos.";
const DEFAULT_IMAGE = "/og-image.png";
function useSeo(options = {}) {
  const route = useRoute();
  const title = computed(() => {
    if (options.title) return `${options.title} | ${SITE_NAME}`;
    return `${SITE_NAME} — Sports Telemetry Overlay`;
  });
  const description = computed(() => options.description || DEFAULT_DESCRIPTION);
  const url = computed(() => options.url || `${SITE_URL}${route.path}`);
  const image = computed(() => options.image || `${SITE_URL}${DEFAULT_IMAGE}`);
  useHead({
    title,
    htmlAttrs: {
      lang: "en"
    },
    link: [
      { rel: "canonical", href: url }
    ],
    script: [
      {
        type: "application/ld+json",
        innerHTML: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebApplication",
          name: SITE_NAME,
          description: description.value,
          url: SITE_URL,
          applicationCategory: "MultimediaApplication",
          operatingSystem: "Any (Web Browser)",
          offers: {
            "@type": "Offer",
            price: "0",
            priceCurrency: "USD"
          },
          featureList: [
            "GPX telemetry visualization",
            "Video overlay generation",
            "WebGPU rendering",
            "Customizable templates",
            "Browser-based processing"
          ]
        })
      }
    ]
  });
  useSeoMeta({
    title,
    description,
    ogTitle: title,
    ogDescription: description,
    ogImage: image,
    ogUrl: url,
    ogSiteName: SITE_NAME,
    ogType: "website",
    twitterCard: "summary_large_image",
    twitterTitle: title,
    twitterDescription: description,
    twitterImage: image
  });
}

export { useSeo as u };
