import { ref, defineComponent, computed, mergeProps, unref, useSSRContext, onMounted } from 'vue';
import { ssrRenderAttrs, ssrRenderAttr, ssrInterpolate, ssrRenderComponent, ssrRenderList, ssrIncludeBooleanAttr } from 'vue/server-renderer';
import { useRouter } from 'vue-router';
import { _ as _export_sfc, u as useFilesStore, a as useSettingsStore, c as checkBrowserCapabilities } from '../main.mjs';
import { u as useSeo } from './useSeo-BEvayQdz.js';
import { F as FileInfo } from './FileInfo-CFg8WvZz.js';
import '@unhead/vue/server';
import 'pinia';
import 'mediabunny';
import '@unhead/vue';

function useFileDrop() {
  const fileInput = ref(null);
  const isDragOver = ref(false);
  function openFileDialog() {
    fileInput.value?.click();
  }
  function onFileSelected(event, onFile) {
    const target = event.target;
    const file = target.files?.[0];
    if (file) onFile(file);
  }
  function onDragEnter() {
    isDragOver.value = true;
  }
  function onDragOver() {
    isDragOver.value = true;
  }
  function onDragLeave() {
    isDragOver.value = false;
  }
  function onDrop(event, onFile) {
    isDragOver.value = false;
    const file = event.dataTransfer?.files[0];
    if (file) onFile(file);
  }
  function resetInput() {
    if (fileInput.value) {
      fileInput.value.value = "";
    }
  }
  return {
    fileInput,
    isDragOver,
    openFileDialog,
    onFileSelected,
    onDragEnter,
    onDragOver,
    onDragLeave,
    onDrop,
    resetInput
  };
}

const _sfc_main$1 = /* @__PURE__ */ defineComponent({
  __name: "UploadZone",
  __ssrInlineRender: true,
  props: {
    accept: {},
    title: {},
    subtitle: {},
    icon: {},
    fileName: {},
    fileSize: {},
    hasFile: { type: Boolean },
    errorMessage: {},
    isLoading: { type: Boolean }
  },
  emits: ["file-selected", "file-removed"],
  setup(__props, { emit: __emit }) {
    const props = __props;
    const {
      isDragOver} = useFileDrop();
    const fileSizeFormatted = computed(() => {
      if (!props.fileSize) return "";
      if (props.fileSize < 1024) return `${props.fileSize} B`;
      if (props.fileSize < 1024 * 1024)
        return `${(props.fileSize / 1024).toFixed(1)} KB`;
      if (props.fileSize < 1024 * 1024 * 1024)
        return `${(props.fileSize / (1024 * 1024)).toFixed(1)} MB`;
      return `${(props.fileSize / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    });
    return (_ctx, _push, _parent, _attrs) => {
      _push(`<div${ssrRenderAttrs(mergeProps({
        class: ["upload-zone", {
          "upload-zone--active": unref(isDragOver),
          "upload-zone--has-file": __props.hasFile,
          "upload-zone--error": __props.errorMessage
        }],
        "data-testid": "upload-zone"
      }, _attrs))} data-v-31b7d80a><input type="file"${ssrRenderAttr("accept", __props.accept)} class="upload-zone__input" data-testid="file-input" data-v-31b7d80a>`);
      if (!__props.hasFile) {
        _push(`<div class="upload-zone__content" data-v-31b7d80a><div class="upload-zone__icon" data-v-31b7d80a>${ssrInterpolate(__props.icon)}</div><p class="upload-zone__title" data-v-31b7d80a>${ssrInterpolate(__props.title)}</p><p class="upload-zone__subtitle" data-v-31b7d80a>${ssrInterpolate(__props.subtitle)}</p></div>`);
      } else {
        _push(`<div class="upload-zone__file-info" data-v-31b7d80a><div class="upload-zone__file-icon" data-v-31b7d80a>✅</div><p class="upload-zone__file-name" data-v-31b7d80a>${ssrInterpolate(__props.fileName)}</p><p class="upload-zone__file-size" data-v-31b7d80a>${ssrInterpolate(fileSizeFormatted.value)}</p><button class="upload-zone__remove" data-testid="remove-file" data-v-31b7d80a> ✕ Remove </button></div>`);
      }
      if (__props.errorMessage) {
        _push(`<p class="upload-zone__error" data-testid="upload-error" data-v-31b7d80a>${ssrInterpolate(__props.errorMessage)}</p>`);
      } else {
        _push(`<!---->`);
      }
      _push(`</div>`);
    };
  }
});

const _sfc_setup$1 = _sfc_main$1.setup;
_sfc_main$1.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("src/components/UploadZone.vue");
  return _sfc_setup$1 ? _sfc_setup$1(props, ctx) : void 0;
};
const UploadZone = /* @__PURE__ */ _export_sfc(_sfc_main$1, [["__scopeId", "data-v-31b7d80a"]]);

const _sfc_main = /* @__PURE__ */ defineComponent({
  __name: "UploadView",
  __ssrInlineRender: true,
  setup(__props) {
    useSeo({
      title: "Upload Files",
      description: "Upload your GPX telemetry and video files to create sports overlay videos. Browser-based processing, no upload required."
    });
    useRouter();
    const filesStore = useFilesStore();
    useSettingsStore();
    const browserCapabilities = ref({ supported: true, missing: [] });
    const videoError = computed(() => {
      if (filesStore.error && filesStore.isLoadingVideo === false && !filesStore.hasVideo) {
        return filesStore.error;
      }
      return null;
    });
    const gpxError = computed(() => {
      if (filesStore.error && filesStore.isLoadingGpx === false && !filesStore.hasGpx) {
        return filesStore.error;
      }
      return null;
    });
    const videoWarnings = computed(
      () => filesStore.videoValidation?.warnings ?? []
    );
    const hasHrData = computed(() => {
      return filesStore.gpxData?.points.some((p) => p.hr !== void 0) ?? false;
    });
    onMounted(() => {
      browserCapabilities.value = checkBrowserCapabilities();
    });
    async function onVideoSelected(file) {
      await filesStore.setVideoFile(file);
    }
    async function onGpxSelected(file) {
      await filesStore.setGpxFile(file);
    }
    function onVideoRemoved() {
      filesStore.videoFile = null;
      filesStore.videoMeta = null;
    }
    function onGpxRemoved() {
      filesStore.gpxFile = null;
      filesStore.gpxData = null;
    }
    function formatDuration(seconds) {
      const min = Math.floor(seconds / 60);
      const sec = Math.round(seconds % 60);
      return `${min}:${sec.toString().padStart(2, "0")}`;
    }
    function formatSize(bytes) {
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
      if (bytes < 1024 * 1024 * 1024)
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
      return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    }
    return (_ctx, _push, _parent, _attrs) => {
      _push(`<div${ssrRenderAttrs(mergeProps({ class: "upload-view" }, _attrs))} data-v-2504707f><header class="upload-view__header" data-v-2504707f><h1 class="upload-view__title" data-v-2504707f>🏃 Telemetriq</h1><p class="upload-view__description" data-v-2504707f> Overlay telemetry from GPX onto your sports video. All processing happens in your browser — your data never leaves your device. </p></header><div class="upload-view__zones" data-v-2504707f>`);
      _push(ssrRenderComponent(UploadZone, {
        accept: "video/mp4,video/quicktime,.mp4,.mov,.m4v",
        title: "Upload video",
        subtitle: "MP4 or MOV, up to 4 GB, up to 60 min",
        icon: "🎬",
        "has-file": unref(filesStore).hasVideo,
        "file-name": unref(filesStore).videoMeta?.fileName,
        "file-size": unref(filesStore).videoMeta?.fileSize,
        "error-message": videoError.value,
        "is-loading": unref(filesStore).isLoadingVideo,
        onFileSelected: onVideoSelected,
        onFileRemoved: onVideoRemoved,
        "data-testid": "video-upload"
      }, null, _parent));
      _push(ssrRenderComponent(UploadZone, {
        accept: ".gpx,application/gpx+xml",
        title: "Upload GPX",
        subtitle: "Track file with GPS and heart rate data",
        icon: "📍",
        "has-file": unref(filesStore).hasGpx,
        "file-name": unref(filesStore).gpxFile?.name,
        "file-size": unref(filesStore).gpxFile?.size,
        "error-message": gpxError.value,
        "is-loading": unref(filesStore).isLoadingGpx,
        onFileSelected: onGpxSelected,
        onFileRemoved: onGpxRemoved,
        "data-testid": "gpx-upload"
      }, null, _parent));
      _push(`</div>`);
      if (unref(filesStore).hasVideo && unref(filesStore).videoMeta) {
        _push(`<div class="upload-view__summary" data-v-2504707f><h3 data-v-2504707f>Video</h3><div class="upload-view__info-grid" data-v-2504707f>`);
        _push(ssrRenderComponent(FileInfo, {
          label: "Resolution",
          value: `${unref(filesStore).videoMeta.width}×${unref(filesStore).videoMeta.height}`
        }, null, _parent));
        _push(ssrRenderComponent(FileInfo, {
          label: "Duration",
          value: formatDuration(unref(filesStore).videoMeta.duration)
        }, null, _parent));
        _push(ssrRenderComponent(FileInfo, {
          label: "Size",
          value: formatSize(unref(filesStore).videoMeta.fileSize)
        }, null, _parent));
        _push(`</div>`);
        if (videoWarnings.value.length) {
          _push(`<div class="upload-view__warning-block" data-v-2504707f><!--[-->`);
          ssrRenderList(videoWarnings.value, (warning) => {
            _push(`<p data-v-2504707f>⚠️ ${ssrInterpolate(warning)}</p>`);
          });
          _push(`<!--]--></div>`);
        } else {
          _push(`<!---->`);
        }
        _push(`</div>`);
      } else {
        _push(`<!---->`);
      }
      if (unref(filesStore).hasGpx && unref(filesStore).gpxData) {
        _push(`<div class="upload-view__summary" data-v-2504707f><h3 data-v-2504707f>GPX track</h3><div class="upload-view__info-grid" data-v-2504707f>`);
        _push(ssrRenderComponent(FileInfo, {
          label: "Name",
          value: unref(filesStore).gpxData.name
        }, null, _parent));
        _push(ssrRenderComponent(FileInfo, {
          label: "Points",
          value: unref(filesStore).gpxData.points.length.toString()
        }, null, _parent));
        if (hasHrData.value) {
          _push(ssrRenderComponent(FileInfo, {
            label: "Heart rate",
            value: "✅ Present"
          }, null, _parent));
        } else {
          _push(ssrRenderComponent(FileInfo, {
            label: "Heart rate",
            value: "❌ Absent"
          }, null, _parent));
        }
        _push(`</div></div>`);
      } else {
        _push(`<!---->`);
      }
      _push(`<div class="upload-view__actions" data-v-2504707f><button class="upload-view__btn upload-view__btn--primary"${ssrIncludeBooleanAttr(!unref(filesStore).isReady) ? " disabled" : ""} data-testid="proceed-btn" data-v-2504707f> Continue → </button></div>`);
      if (!browserCapabilities.value.supported) {
        _push(`<div class="upload-view__warning" data-testid="browser-warning" data-v-2504707f><p data-v-2504707f>⚠️ Your browser does not support the required APIs:</p><ul data-v-2504707f><!--[-->`);
        ssrRenderList(browserCapabilities.value.missing, (api) => {
          _push(`<li data-v-2504707f>${ssrInterpolate(api)}</li>`);
        });
        _push(`<!--]--></ul><p data-v-2504707f>We recommend using the latest Chrome.</p></div>`);
      } else {
        _push(`<!---->`);
      }
      _push(`</div>`);
    };
  }
});

const _sfc_setup = _sfc_main.setup;
_sfc_main.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("src/views/UploadView.vue");
  return _sfc_setup ? _sfc_setup(props, ctx) : void 0;
};
const UploadView = /* @__PURE__ */ _export_sfc(_sfc_main, [["__scopeId", "data-v-2504707f"]]);

export { UploadView as default };
