import { defineComponent, computed, onMounted, mergeProps, unref, useSSRContext } from 'vue';
import { ssrRenderAttrs, ssrRenderAttr, ssrRenderComponent } from 'vue/server-renderer';
import { useRouter } from 'vue-router';
import { u as useFilesStore, j as useProcessingStore, a as useSettingsStore, e as useSyncStore, _ as _export_sfc } from '../main.mjs';
import { u as useSeo } from './useSeo-BEvayQdz.js';
import { F as FileInfo } from './FileInfo-CFg8WvZz.js';
import '@unhead/vue/server';
import 'pinia';
import 'mediabunny';
import '@unhead/vue';

const _sfc_main = /* @__PURE__ */ defineComponent({
  __name: "ResultView",
  __ssrInlineRender: true,
  setup(__props) {
    useSeo({
      title: "Download Result",
      description: "Download your video with telemetry overlay. Share your sports achievements with professional-looking visualizations."
    });
    const router = useRouter();
    useFilesStore();
    const processingStore = useProcessingStore();
    useSettingsStore();
    useSyncStore();
    const resultSize = computed(() => {
      const size = processingStore.resultBlob?.size ?? 0;
      if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
      if (size < 1024 * 1024 * 1024)
        return `${(size / (1024 * 1024)).toFixed(1)} MB`;
      return `${(size / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    });
    onMounted(() => {
      if (!processingStore.hasResult) {
        router.push("/");
      }
    });
    return (_ctx, _push, _parent, _attrs) => {
      _push(`<div${ssrRenderAttrs(mergeProps({ class: "result-view" }, _attrs))} data-v-76b9c1b2><header class="result-view__header" data-v-76b9c1b2><h2 data-v-76b9c1b2>🎉 Video is ready!</h2><p class="result-view__subtitle" data-v-76b9c1b2> Your video with telemetry is ready for download </p></header>`);
      if (unref(processingStore).resultUrl) {
        _push(`<div class="result-view__preview" data-v-76b9c1b2><video${ssrRenderAttr("src", unref(processingStore).resultUrl)} controls class="result-view__video" data-testid="result-video" data-v-76b9c1b2></video></div>`);
      } else {
        _push(`<!---->`);
      }
      if (unref(processingStore).resultBlob) {
        _push(`<div class="result-view__info" data-v-76b9c1b2>`);
        _push(ssrRenderComponent(FileInfo, {
          label: "Format",
          value: "MP4 (H.264)"
        }, null, _parent));
        _push(ssrRenderComponent(FileInfo, {
          label: "Size",
          value: resultSize.value
        }, null, _parent));
        _push(`</div>`);
      } else {
        _push(`<!---->`);
      }
      _push(`<div class="result-view__actions" data-v-76b9c1b2><button class="result-view__btn result-view__btn--primary" data-testid="download-btn" data-v-76b9c1b2> ⬇️ Download video </button><button class="result-view__btn" data-testid="start-over-btn" data-v-76b9c1b2> 🔄 Start over </button></div></div>`);
    };
  }
});

const _sfc_setup = _sfc_main.setup;
_sfc_main.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("src/views/ResultView.vue");
  return _sfc_setup ? _sfc_setup(props, ctx) : void 0;
};
const ResultView = /* @__PURE__ */ _export_sfc(_sfc_main, [["__scopeId", "data-v-76b9c1b2"]]);

export { ResultView as default };
