import { defineComponent, ref, watch, onMounted, onUnmounted, mergeProps, useSSRContext, computed, unref } from 'vue';
import { ssrRenderAttrs, ssrRenderAttr, ssrInterpolate, ssrRenderList, ssrRenderComponent, ssrIncludeBooleanAttr, ssrLooseContain, ssrLooseEqual } from 'vue/server-renderer';
import { useRouter } from 'vue-router';
import { g as getTelemetryAtTime, r as renderOverlay, _ as _export_sfc, b as getSyncRangeSeconds, d as getAllTemplateMetadata, a as useSettingsStore, u as useFilesStore, e as useSyncStore, f as buildTelemetryTimeline } from '../main.mjs';
import { u as useSeo } from './useSeo-BEvayQdz.js';
import '@unhead/vue/server';
import 'pinia';
import 'mediabunny';
import '@unhead/vue';

const _sfc_main$3 = /* @__PURE__ */ defineComponent({
  __name: "VideoPlayer",
  __ssrInlineRender: true,
  props: {
    src: {},
    telemetryFrames: {},
    overlayConfig: {},
    syncOffset: {}
  },
  setup(__props) {
    const props = __props;
    const videoRef = ref(null);
    const overlayCanvas = ref(null);
    const videoWidth = ref(640);
    const videoHeight = ref(360);
    const currentTime = ref(0);
    let videoFrameHandle = null;
    function scheduleFrameCallback() {
      const video = videoRef.value;
      if (!video) return;
      const requestVideoFrameCallback = video.requestVideoFrameCallback;
      if (typeof requestVideoFrameCallback !== "function") return;
      videoFrameHandle = requestVideoFrameCallback.call(video, (_, meta) => {
        currentTime.value = meta.mediaTime;
        drawOverlay();
        scheduleFrameCallback();
      });
    }
    async function drawOverlay() {
      const canvas = overlayCanvas.value;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, videoWidth.value, videoHeight.value);
      const frame = getTelemetryAtTime(
        props.telemetryFrames,
        currentTime.value,
        props.syncOffset
      );
      if (frame) {
        await renderOverlay(
          ctx,
          frame,
          videoWidth.value,
          videoHeight.value,
          props.overlayConfig
        );
      }
    }
    watch(() => props.syncOffset, drawOverlay);
    watch(() => props.overlayConfig, drawOverlay, { deep: true });
    watch(() => props.telemetryFrames, drawOverlay, { deep: true });
    onMounted(() => {
      const video = videoRef.value;
      if (!video) return;
      const requestVideoFrameCallback = video.requestVideoFrameCallback;
      if (typeof requestVideoFrameCallback === "function") {
        scheduleFrameCallback();
      }
    });
    onUnmounted(() => {
      if (videoFrameHandle !== null && videoRef.value) {
        const video = videoRef.value;
        video.cancelVideoFrameCallback?.(videoFrameHandle);
      }
    });
    return (_ctx, _push, _parent, _attrs) => {
      _push(`<div${ssrRenderAttrs(mergeProps({
        class: "video-player",
        "data-testid": "video-player"
      }, _attrs))} data-v-dabbc83b><video${ssrRenderAttr("src", __props.src)} class="video-player__video" controls data-v-dabbc83b></video><div class="video-player__overlay-canvas" data-v-dabbc83b><canvas${ssrRenderAttr("width", videoWidth.value)}${ssrRenderAttr("height", videoHeight.value)} class="video-player__overlay" data-v-dabbc83b></canvas></div></div>`);
    };
  }
});

const _sfc_setup$3 = _sfc_main$3.setup;
_sfc_main$3.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("src/components/VideoPlayer.vue");
  return _sfc_setup$3 ? _sfc_setup$3(props, ctx) : void 0;
};
const VideoPlayer = /* @__PURE__ */ _export_sfc(_sfc_main$3, [["__scopeId", "data-v-dabbc83b"]]);

const _sfc_main$2 = /* @__PURE__ */ defineComponent({
  __name: "SyncSlider",
  __ssrInlineRender: true,
  props: {
    offsetSeconds: {},
    isAutoSynced: { type: Boolean },
    videoDurationSeconds: {},
    error: {},
    warning: {}
  },
  emits: ["update:offsetSeconds"],
  setup(__props, { emit: __emit }) {
    const props = __props;
    const maxRange = computed(() => {
      const base = getSyncRangeSeconds(props.videoDurationSeconds);
      const current = Math.ceil(Math.abs(props.offsetSeconds)) + 1;
      return Math.max(base, current);
    });
    const formattedOffset = computed(() => {
      const seconds = props.offsetSeconds;
      const sign = seconds >= 0 ? "+" : "";
      if (Math.abs(seconds) >= 60) {
        const min = Math.floor(Math.abs(seconds) / 60);
        const sec = Math.abs(seconds) % 60;
        const prefix = seconds < 0 ? "-" : "+";
        return `${prefix}${min}m ${sec.toFixed(1)}s`;
      }
      return `${sign}${seconds.toFixed(1)}s`;
    });
    function formatTime(seconds) {
      if (seconds >= 60) {
        return `${Math.floor(seconds / 60)}m`;
      }
      return `${seconds}s`;
    }
    return (_ctx, _push, _parent, _attrs) => {
      _push(`<div${ssrRenderAttrs(mergeProps({
        class: "sync-slider",
        "data-testid": "sync-slider"
      }, _attrs))} data-v-9a89e06a><div class="sync-slider__header" data-v-9a89e06a><h3 class="sync-slider__title" data-v-9a89e06a>Synchronization</h3>`);
      if (__props.isAutoSynced) {
        _push(`<span class="sync-slider__badge sync-slider__badge--auto" data-v-9a89e06a> Auto </span>`);
      } else {
        _push(`<span class="sync-slider__badge sync-slider__badge--manual" data-v-9a89e06a> Manual </span>`);
      }
      _push(`</div><div class="sync-slider__controls" data-v-9a89e06a><label class="sync-slider__label" data-v-9a89e06a> Offset: <strong data-v-9a89e06a>${ssrInterpolate(formattedOffset.value)}</strong></label><input type="range"${ssrRenderAttr("min", -maxRange.value)}${ssrRenderAttr("max", maxRange.value)}${ssrRenderAttr("step", 0.5)}${ssrRenderAttr("value", __props.offsetSeconds)} class="sync-slider__range" data-testid="sync-range" data-v-9a89e06a><div class="sync-slider__range-labels" data-v-9a89e06a><span data-v-9a89e06a>-${ssrInterpolate(formatTime(maxRange.value))}</span><span data-v-9a89e06a>0</span><span data-v-9a89e06a>+${ssrInterpolate(formatTime(maxRange.value))}</span></div></div><div class="sync-slider__fine-controls" data-v-9a89e06a><button class="sync-slider__btn" data-testid="sync-minus1" data-v-9a89e06a> -1s </button><button class="sync-slider__btn" data-v-9a89e06a> -0.5s </button><button class="sync-slider__btn sync-slider__btn--reset" data-testid="sync-reset" data-v-9a89e06a> Reset </button><button class="sync-slider__btn" data-v-9a89e06a>+0.5s</button><button class="sync-slider__btn" data-testid="sync-plus1" data-v-9a89e06a> +1s </button></div>`);
      if (__props.warning) {
        _push(`<p class="sync-slider__warning" data-v-9a89e06a>${ssrInterpolate(__props.warning)}</p>`);
      } else {
        _push(`<!---->`);
      }
      if (__props.error) {
        _push(`<p class="sync-slider__error" data-v-9a89e06a>${ssrInterpolate(__props.error)}</p>`);
      } else {
        _push(`<!---->`);
      }
      _push(`</div>`);
    };
  }
});

const _sfc_setup$2 = _sfc_main$2.setup;
_sfc_main$2.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("src/components/SyncSlider.vue");
  return _sfc_setup$2 ? _sfc_setup$2(props, ctx) : void 0;
};
const SyncSlider = /* @__PURE__ */ _export_sfc(_sfc_main$2, [["__scopeId", "data-v-9a89e06a"]]);

const _sfc_main$1 = /* @__PURE__ */ defineComponent({
  __name: "TemplateSelector",
  __ssrInlineRender: true,
  setup(__props) {
    const templates = getAllTemplateMetadata();
    const settingsStore = useSettingsStore();
    const selectedTemplate = computed(
      () => templates.find((t) => t.id === settingsStore.currentTemplateId)
    );
    return (_ctx, _push, _parent, _attrs) => {
      _push(`<div${ssrRenderAttrs(mergeProps({ class: "template-selector" }, _attrs))} data-v-734d9c18><div class="template-dropdown" data-v-734d9c18><label class="template-dropdown__label" for="template-select" data-v-734d9c18>Template</label><select id="template-select" class="template-dropdown__select"${ssrRenderAttr("value", unref(settingsStore).currentTemplateId)} data-v-734d9c18><!--[-->`);
      ssrRenderList(unref(templates), (template) => {
        _push(`<option${ssrRenderAttr("value", template.id)} data-v-734d9c18>${ssrInterpolate(template.name)}</option>`);
      });
      _push(`<!--]--></select>`);
      if (selectedTemplate.value) {
        _push(`<p class="template-dropdown__description" data-v-734d9c18>${ssrInterpolate(selectedTemplate.value.description)}</p>`);
      } else {
        _push(`<!---->`);
      }
      _push(`</div></div>`);
    };
  }
});

const _sfc_setup$1 = _sfc_main$1.setup;
_sfc_main$1.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("src/components/TemplateSelector.vue");
  return _sfc_setup$1 ? _sfc_setup$1(props, ctx) : void 0;
};
const TemplateSelector = /* @__PURE__ */ _export_sfc(_sfc_main$1, [["__scopeId", "data-v-734d9c18"]]);

const _sfc_main = /* @__PURE__ */ defineComponent({
  __name: "PreviewView",
  __ssrInlineRender: true,
  setup(__props) {
    useSeo({
      title: "Preview & Customize",
      description: "Preview and customize your telemetry overlay. Adjust sync, select templates, and position metrics before processing."
    });
    const router = useRouter();
    const filesStore = useFilesStore();
    const syncStore = useSyncStore();
    const settingsStore = useSettingsStore();
    const videoUrl = ref(null);
    const telemetryFrames = ref([]);
    const manualStartTime = ref("");
    const manualTimezone = ref(180);
    const canChangePosition = computed(
      () => settingsStore.currentTemplateId === "classic"
    );
    const timezones = [
      { value: -720, label: "UTC-12" },
      { value: -660, label: "UTC-11" },
      { value: -600, label: "UTC-10" },
      { value: -540, label: "UTC-9" },
      { value: -480, label: "UTC-8 (Pacific)" },
      { value: -420, label: "UTC-7 (Mountain)" },
      { value: -360, label: "UTC-6 (Central)" },
      { value: -300, label: "UTC-5 (Eastern)" },
      { value: -240, label: "UTC-4 (Atlantic)" },
      { value: -180, label: "UTC-3" },
      { value: -120, label: "UTC-2" },
      { value: -60, label: "UTC-1" },
      { value: 0, label: "UTC" },
      { value: 60, label: "UTC+1" },
      { value: 120, label: "UTC+2" },
      { value: 180, label: "UTC+3 (Moscow)" },
      { value: 240, label: "UTC+4" },
      { value: 300, label: "UTC+5" },
      { value: 330, label: "UTC+5:30 (India)" },
      { value: 360, label: "UTC+6" },
      { value: 420, label: "UTC+7" },
      { value: 480, label: "UTC+8" },
      { value: 540, label: "UTC+9" },
      { value: 600, label: "UTC+10" },
      { value: 660, label: "UTC+11" },
      { value: 720, label: "UTC+12" }
    ];
    onMounted(() => {
      if (!filesStore.isReady) {
        router.push("/");
        return;
      }
      if (filesStore.videoFile) {
        videoUrl.value = URL.createObjectURL(filesStore.videoFile);
      }
      if (filesStore.gpxData) {
        telemetryFrames.value = buildTelemetryTimeline(filesStore.gpxData.points);
      }
      if (filesStore.gpxData) {
        syncStore.performAutoSync(
          filesStore.gpxData.points,
          filesStore.videoMeta?.startTime,
          filesStore.videoMeta?.gps?.lat,
          filesStore.videoMeta?.gps?.lon,
          filesStore.videoMeta?.timezoneOffsetMinutes,
          false,
          filesStore.videoMeta?.duration
        );
      }
    });
    onUnmounted(() => {
      if (videoUrl.value) {
        URL.revokeObjectURL(videoUrl.value);
      }
    });
    function onManualOffsetChange(offsetSeconds) {
      syncStore.setManualOffset(offsetSeconds, filesStore.videoMeta?.duration);
    }
    return (_ctx, _push, _parent, _attrs) => {
      _push(`<div${ssrRenderAttrs(mergeProps({ class: "preview-view" }, _attrs))} data-v-3307635d><header class="preview-view__header" data-v-3307635d><button class="preview-view__back" data-testid="back-btn" data-v-3307635d> ← Back </button><h2 data-v-3307635d>Preview &amp; Sync</h2></header><div class="preview-view__workspace" data-v-3307635d><div class="preview-view__main" data-v-3307635d>`);
      if (videoUrl.value && telemetryFrames.value.length > 0) {
        _push(`<div class="preview-view__player" data-v-3307635d>`);
        _push(ssrRenderComponent(VideoPlayer, {
          src: videoUrl.value,
          "telemetry-frames": telemetryFrames.value,
          "overlay-config": unref(settingsStore).overlayConfig,
          "sync-offset": unref(syncStore).offsetSeconds
        }, null, _parent));
        _push(`</div>`);
      } else {
        _push(`<!---->`);
      }
      _push(`<div class="preview-view__sync-controls" data-v-3307635d><h3 data-v-3307635d>Synchronization</h3><p class="preview-view__desc" data-v-3307635d> Align telemetry data with video timeline. </p>`);
      _push(ssrRenderComponent(SyncSlider, {
        "offset-seconds": unref(syncStore).offsetSeconds,
        "is-auto-synced": unref(syncStore).isAutoSynced,
        "video-duration-seconds": unref(filesStore).videoMeta?.duration,
        error: unref(syncStore).syncError,
        warning: unref(syncStore).syncWarning,
        "onUpdate:offsetSeconds": onManualOffsetChange
      }, null, _parent));
      _push(`<div class="preview-view__divider" data-v-3307635d></div><div class="preview-view__manual-sync" data-v-3307635d><label class="preview-view__label" data-v-3307635d>Manual start time</label><p class="preview-view__hint" data-v-3307635d> Set activity start time if auto-sync fails. </p><div class="preview-view__field-row" data-v-3307635d><input${ssrRenderAttr("value", manualStartTime.value)} type="datetime-local" class="preview-view__input" placeholder="Select date &amp; time" data-v-3307635d><button class="preview-view__btn preview-view__btn--secondary" data-v-3307635d> Apply </button></div><div class="preview-view__field-row preview-view__timezone-row" data-v-3307635d><label class="preview-view__label preview-view__label--small" data-v-3307635d>Timezone</label><select class="preview-view__select" data-v-3307635d><!--[-->`);
      ssrRenderList(timezones, (tz) => {
        _push(`<option${ssrRenderAttr("value", tz.value)} data-v-3307635d${ssrIncludeBooleanAttr(Array.isArray(manualTimezone.value) ? ssrLooseContain(manualTimezone.value, tz.value) : ssrLooseEqual(manualTimezone.value, tz.value)) ? " selected" : ""}>${ssrInterpolate(tz.label)}</option>`);
      });
      _push(`<!--]--></select></div></div></div></div><aside class="preview-view__sidebar" data-v-3307635d><div class="preview-view__card" data-v-3307635d><h3 data-v-3307635d>Template</h3><p class="preview-view__desc" data-v-3307635d> Choose a design template for your telemetry overlay. </p>`);
      _push(ssrRenderComponent(TemplateSelector, null, null, _parent));
      _push(`<div class="preview-view__divider" data-v-3307635d></div></div><div class="preview-view__card" data-v-3307635d><h3 data-v-3307635d>Overlay settings</h3><p class="preview-view__desc" data-v-3307635d> Configure what appears on the video. Changes apply in real-time. </p><div class="preview-view__settings" data-v-3307635d><label class="preview-view__checkbox" data-v-3307635d><input type="checkbox"${ssrIncludeBooleanAttr(Array.isArray(unref(settingsStore).overlayConfig.showHr) ? ssrLooseContain(unref(settingsStore).overlayConfig.showHr, null) : unref(settingsStore).overlayConfig.showHr) ? " checked" : ""} data-v-3307635d><span data-v-3307635d>❤️ Heart rate</span></label><label class="preview-view__checkbox" data-v-3307635d><input type="checkbox"${ssrIncludeBooleanAttr(Array.isArray(unref(settingsStore).overlayConfig.showPace) ? ssrLooseContain(unref(settingsStore).overlayConfig.showPace, null) : unref(settingsStore).overlayConfig.showPace) ? " checked" : ""} data-v-3307635d><span data-v-3307635d>🏃 Pace</span></label><label class="preview-view__checkbox" data-v-3307635d><input type="checkbox"${ssrIncludeBooleanAttr(Array.isArray(unref(settingsStore).overlayConfig.showDistance) ? ssrLooseContain(unref(settingsStore).overlayConfig.showDistance, null) : unref(settingsStore).overlayConfig.showDistance) ? " checked" : ""} data-v-3307635d><span data-v-3307635d>📏 Distance</span></label><label class="preview-view__checkbox" data-v-3307635d><input type="checkbox"${ssrIncludeBooleanAttr(Array.isArray(unref(settingsStore).overlayConfig.showTime) ? ssrLooseContain(unref(settingsStore).overlayConfig.showTime, null) : unref(settingsStore).overlayConfig.showTime) ? " checked" : ""} data-v-3307635d><span data-v-3307635d>⏱️ Time</span></label></div><div class="preview-view__divider" data-v-3307635d></div>`);
      if (canChangePosition.value) {
        _push(`<div class="preview-view__field" data-v-3307635d><label class="preview-view__label" data-v-3307635d>Position</label><select class="preview-view__select" data-v-3307635d><option value="top-left" data-v-3307635d${ssrIncludeBooleanAttr(Array.isArray(unref(settingsStore).overlayConfig.position) ? ssrLooseContain(unref(settingsStore).overlayConfig.position, "top-left") : ssrLooseEqual(unref(settingsStore).overlayConfig.position, "top-left")) ? " selected" : ""}>Top left</option><option value="top-right" data-v-3307635d${ssrIncludeBooleanAttr(Array.isArray(unref(settingsStore).overlayConfig.position) ? ssrLooseContain(unref(settingsStore).overlayConfig.position, "top-right") : ssrLooseEqual(unref(settingsStore).overlayConfig.position, "top-right")) ? " selected" : ""}>Top right</option><option value="bottom-left" data-v-3307635d${ssrIncludeBooleanAttr(Array.isArray(unref(settingsStore).overlayConfig.position) ? ssrLooseContain(unref(settingsStore).overlayConfig.position, "bottom-left") : ssrLooseEqual(unref(settingsStore).overlayConfig.position, "bottom-left")) ? " selected" : ""}>Bottom left</option><option value="bottom-right" data-v-3307635d${ssrIncludeBooleanAttr(Array.isArray(unref(settingsStore).overlayConfig.position) ? ssrLooseContain(unref(settingsStore).overlayConfig.position, "bottom-right") : ssrLooseEqual(unref(settingsStore).overlayConfig.position, "bottom-right")) ? " selected" : ""}>Bottom right</option></select></div>`);
      } else {
        _push(`<!---->`);
      }
      _push(`</div><button class="preview-view__btn preview-view__btn--primary" data-testid="process-btn" data-v-3307635d> 🚀 Start processing </button></aside></div></div>`);
    };
  }
});

const _sfc_setup = _sfc_main.setup;
_sfc_main.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("src/views/PreviewView.vue");
  return _sfc_setup ? _sfc_setup(props, ctx) : void 0;
};
const PreviewView = /* @__PURE__ */ _export_sfc(_sfc_main, [["__scopeId", "data-v-3307635d"]]);

export { PreviewView as default };
