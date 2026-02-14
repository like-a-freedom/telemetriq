import { createHead } from '@unhead/vue/server';
import { defineComponent, ref, onMounted, createSSRApp, useSSRContext, resolveComponent, mergeProps, computed } from 'vue';
import { createRouter, createMemoryHistory, createWebHistory } from 'vue-router';
import { defineStore, createPinia } from 'pinia';
import { ssrRenderAttrs, ssrRenderComponent } from 'vue/server-renderer';
import { Input, BlobSource, ALL_FORMATS } from 'mediabunny';

const ClientOnly = defineComponent({
  setup(props, { slots }) {
    const mounted = ref(false);
    onMounted(() => mounted.value = true);
    return () => {
      if (!mounted.value)
        return slots.placeholder && slots.placeholder({});
      return slots.default && slots.default({});
    };
  }
});

function ViteSSG(App, routerOptions, fn, options) {
  const {
    transformState,
    registerComponents = true,
    useHead = true,
    rootContainer = "#app"
  } = {};
  async function createApp$1(routePath) {
    const app = createSSRApp(App) ;
    let head;
    if (useHead) {
      app.use(head = createHead() );
    }
    const router = createRouter({
      history: createMemoryHistory(routerOptions.base) ,
      ...routerOptions
    });
    const { routes } = routerOptions;
    if (registerComponents)
      app.component("ClientOnly", ClientOnly);
    const appRenderCallbacks = [];
    const onSSRAppRendered = (cb) => appRenderCallbacks.push(cb) ;
    const triggerOnSSRAppRendered = () => {
      return Promise.all(appRenderCallbacks.map((cb) => cb()));
    };
    const context = {
      app,
      head,
      isClient: false,
      router,
      routes,
      onSSRAppRendered,
      triggerOnSSRAppRendered,
      initialState: {},
      transformState,
      routePath
    };
    await fn?.(context);
    app.use(router);
    let entryRoutePath;
    let isFirstRoute = true;
    router.beforeEach((to, from, next) => {
      if (isFirstRoute || entryRoutePath && entryRoutePath === to.path) {
        isFirstRoute = false;
        entryRoutePath = to.path;
        to.meta.state = context.initialState;
      }
      next();
    });
    {
      const route = context.routePath ?? "/";
      router.push(route);
      await router.isReady();
      context.initialState = router.currentRoute.value.meta.state || {};
    }
    const initialState = context.initialState;
    return {
      ...context,
      initialState
    };
  }
  return createApp$1;
}

const _export_sfc = (sfc, props) => {
  const target = sfc.__vccOpts || sfc;
  for (const [key, val] of props) {
    target[key] = val;
  }
  return target;
};

const _sfc_main = {  };

function _sfc_ssrRender(_ctx, _push, _parent, _attrs) {
  const _component_router_view = resolveComponent("router-view");

  _push(`<div${ssrRenderAttrs(mergeProps({ id: "app-root" }, _attrs))} data-v-d2f08e61>`);
  _push(ssrRenderComponent(_component_router_view, null, null, _parent));
  _push(`</div>`);
}
const _sfc_setup = _sfc_main.setup;
_sfc_main.setup = (props, ctx) => {
  const ssrContext = useSSRContext()
  ;(ssrContext.modules || (ssrContext.modules = new Set())).add("src/App.vue");
  return _sfc_setup ? _sfc_setup(props, ctx) : undefined
};
const App = /*#__PURE__*/_export_sfc(_sfc_main, [['ssrRender',_sfc_ssrRender],['__scopeId',"data-v-d2f08e61"]]);

const routes = [
  {
    path: "/",
    name: "upload",
    component: () => import('./assets/UploadView-CavTTgM9.js'),
    meta: {
      title: "Upload Files — Telemetriq",
      description: "Upload your GPX telemetry and video files to create sports overlay videos"
    }
  },
  {
    path: "/preview",
    name: "preview",
    component: () => import('./assets/PreviewView-Dh7vSrUf.js'),
    meta: {
      title: "Preview — Telemetriq",
      description: "Preview and customize your telemetry overlay before processing"
    }
  },
  {
    path: "/processing",
    name: "processing",
    component: () => import('./assets/ProcessingView-Dat9RPWD.js'),
    meta: {
      title: "Processing — Telemetriq",
      description: "Your video is being processed with telemetry overlay"
    }
  },
  {
    path: "/result",
    name: "result",
    component: () => import('./assets/ResultView-Y5AbDx70.js'),
    meta: {
      title: "Download Result — Telemetriq",
      description: "Download your video with telemetry overlay"
    }
  }
];
createRouter({
  history: createWebHistory(),
  routes
});

class AppError extends Error {
  code;
  details;
  constructor(message, code, details) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.details = details;
  }
}
class ValidationError extends AppError {
  constructor(message, details) {
    super(message, "VALIDATION_ERROR", details);
  }
}
class ParseError extends AppError {
  constructor(message, details) {
    super(message, "PARSE_ERROR", details);
  }
}
class SyncError extends AppError {
  constructor(message, details) {
    super(message, "SYNC_ERROR", details);
  }
}
class ProcessingError extends AppError {
  constructor(message, details) {
    super(message, "PROCESSING_ERROR", details);
  }
}

const MAX_GPX_SIZE = 50 * 1024 * 1024;
const ALLOWED_EXTENSIONS = [".gpx"];
function validateGpxFile(file) {
  const errors = [];
  const warnings = [];
  const ext = file.name.toLowerCase().slice(file.name.lastIndexOf("."));
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    errors.push(`Unsupported file format: ${ext}. Expected .gpx`);
  }
  if (file.size > MAX_GPX_SIZE) {
    errors.push(`File is too large: ${(file.size / 1024 / 1024).toFixed(1)} MB. Max ${MAX_GPX_SIZE / 1024 / 1024} MB`);
  }
  if (file.size === 0) {
    errors.push("File is empty");
  }
  return { valid: errors.length === 0, errors, warnings };
}
function parseGpx(xmlString) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString, "text/xml");
  const parseErrors = doc.querySelectorAll("parsererror");
  if (parseErrors.length > 0) {
    throw new ParseError("Failed to parse GPX file: invalid XML", {
      details: parseErrors[0]?.textContent ?? "Unknown parse error"
    });
  }
  const gpxElement = doc.querySelector("gpx");
  if (!gpxElement) {
    throw new ParseError("Root <gpx> element not found");
  }
  const metadata = parseMetadata(doc);
  const name = parseTrackName(doc);
  const points = parseTrackPoints(doc);
  if (points.length === 0) {
    throw new ParseError("GPX file contains no track points");
  }
  return { name, points, metadata };
}
function parseMetadata(doc) {
  const gpxElement = doc.querySelector("gpx");
  const metaElement = doc.querySelector("metadata");
  const creator = gpxElement?.getAttribute("creator") ?? void 0;
  const timeStr = metaElement?.querySelector("time")?.textContent;
  const description = metaElement?.querySelector("desc")?.textContent ?? void 0;
  return {
    creator,
    time: timeStr ? new Date(timeStr) : void 0,
    description: description ?? void 0
  };
}
function parseTrackName(doc) {
  const nameElement = doc.querySelector("trk > name");
  return nameElement?.textContent ?? "Unnamed Track";
}
function parseTrackPoints(doc) {
  const trkpts = doc.querySelectorAll("trkpt");
  const points = [];
  for (const trkpt of trkpts) {
    const lat = parseFloat(trkpt.getAttribute("lat") ?? "");
    const lon = parseFloat(trkpt.getAttribute("lon") ?? "");
    if (isNaN(lat) || isNaN(lon)) {
      continue;
    }
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      continue;
    }
    const eleElement = trkpt.querySelector("ele");
    const ele = eleElement ? parseFloat(eleElement.textContent ?? "") : void 0;
    const timeElement = trkpt.querySelector("time");
    if (!timeElement?.textContent) {
      continue;
    }
    const time = new Date(timeElement.textContent);
    if (isNaN(time.getTime())) {
      continue;
    }
    const hr = extractHeartRate(trkpt);
    points.push({
      lat,
      lon,
      ele: ele !== void 0 && !isNaN(ele) ? ele : void 0,
      time,
      hr
    });
  }
  return points;
}
function extractHeartRate(trkpt) {
  const extensions = trkpt.querySelector("extensions");
  if (!extensions) return void 0;
  const garminHr = extensions.querySelector("TrackPointExtension > hr");
  if (garminHr?.textContent) {
    const val = parseInt(garminHr.textContent, 10);
    if (!isNaN(val) && val > 0 && val < 300) return val;
  }
  const allElements = extensions.getElementsByTagName("*");
  for (const el of allElements) {
    const localName = el.localName || el.nodeName.split(":").pop();
    if (localName === "hr" || localName === "heartrate" || localName === "heart_rate") {
      const val = parseInt(el.textContent ?? "", 10);
      if (!isNaN(val) && val > 0 && val < 300) return val;
    }
  }
  return void 0;
}
async function readAndParseGpx(file) {
  const validation = validateGpxFile(file);
  if (!validation.valid) {
    throw new ValidationError(validation.errors.join("; "));
  }
  const text = await file.text();
  return parseGpx(text);
}

const MAX_VIDEO_SIZE = 4 * 1024 * 1024 * 1024;
const MAX_VIDEO_DURATION_SECONDS = 60 * 60;
const WARN_DURATION_SECONDS = 30 * 60;
const FAST_METADATA_THRESHOLD_BYTES = 1024 * 1024 * 1024;
const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/x-m4v"];
const ALLOWED_VIDEO_EXTENSIONS = [".mp4", ".mov", ".m4v"];
function parseDjiFilename(filename) {
  const djiMatch = filename.match(/^DJI_(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})/i);
  if (!djiMatch) return void 0;
  const [, year, month, day, hour, minute, second] = djiMatch;
  const date = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second)
  );
  if (Number.isNaN(date.getTime())) return void 0;
  return { date, isLocalTime: true };
}
function validateVideoFile(file) {
  const errors = [];
  const warnings = [];
  const ext = file.name.toLowerCase().slice(file.name.lastIndexOf("."));
  if (!ALLOWED_VIDEO_EXTENSIONS.includes(ext)) {
    errors.push(`Unsupported format: ${ext}. Expected MP4 or MOV`);
  }
  if (file.type && !ALLOWED_VIDEO_TYPES.includes(file.type)) {
    warnings.push(`Non-standard MIME type: ${file.type}`);
  }
  if (file.size > MAX_VIDEO_SIZE) {
    errors.push(`File is too large: ${(file.size / (1024 * 1024 * 1024)).toFixed(1)} GB. Max 4 GB`);
  }
  if (file.size === 0) {
    errors.push("File is empty");
  }
  return { valid: errors.length === 0, errors, warnings };
}
function extractVideoMeta(file) {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    const url = URL.createObjectURL(file);
    video.src = url;
    video.onloadedmetadata = () => {
      const djiParsed = parseDjiFilename(file.name);
      const djiStartTime = djiParsed?.date;
      const fsStartTime = file.lastModified ? new Date(file.lastModified) : void 0;
      const startTime = djiStartTime ?? fsStartTime;
      const meta = {
        duration: video.duration,
        width: video.videoWidth,
        height: video.videoHeight,
        fps: 30,
        // Default, will be refined during processing
        codec: "unknown",
        fileSize: file.size,
        fileName: file.name,
        startTime,
        // DJI filename time is local time, convert browser offset to positive timezone
        // getTimezoneOffset() returns negative for positive timezones (e.g., -180 for UTC+3)
        // We invert it so that sync engine can use: localTime - offset = UTC
        timezoneOffsetMinutes: djiParsed ? -djiParsed.date.getTimezoneOffset() : startTime ? startTime.getTimezoneOffset() : void 0
      };
      URL.revokeObjectURL(url);
      if (meta.duration > MAX_VIDEO_DURATION_SECONDS) {
        reject(new ValidationError(
          `Video is too long: ${Math.round(meta.duration / 60)} min. Max 60 min`
        ));
        return;
      }
      if (file.size >= FAST_METADATA_THRESHOLD_BYTES) {
        resolve(meta);
        return;
      }
      extractMp4Metadata(file).then((mp4Meta) => {
        if (mp4Meta.codec) meta.codec = mp4Meta.codec;
        if (mp4Meta.fps) meta.fps = mp4Meta.fps;
        if (meta.width <= 0 && mp4Meta.width && mp4Meta.width > 0) {
          meta.width = mp4Meta.width;
        }
        if (meta.height <= 0 && mp4Meta.height && mp4Meta.height > 0) {
          meta.height = mp4Meta.height;
        }
        if ((!Number.isFinite(meta.duration) || meta.duration <= 0) && mp4Meta.duration && mp4Meta.duration > 0) {
          meta.duration = mp4Meta.duration;
        }
        if (mp4Meta.startTime) {
          meta.startTime = mp4Meta.startTime;
          meta.timezoneOffsetMinutes = 0;
        }
        if (mp4Meta.gps) meta.gps = mp4Meta.gps;
      }).catch(() => void 0).finally(() => {
        if (meta.width <= 0 || meta.height <= 0) {
          reject(new ValidationError("Failed to determine video resolution from metadata"));
          return;
        }
        resolve(meta);
      });
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new ValidationError("Failed to read video metadata"));
    };
  });
}
async function extractMp4Metadata(file) {
  const input = new Input({
    formats: ALL_FORMATS,
    source: new BlobSource(file)
  });
  try {
    const videoTrack = await input.getPrimaryVideoTrack();
    const codec = videoTrack ? await videoTrack.getCodecParameterString() ?? (await videoTrack.getDecoderConfig())?.codec : void 0;
    const fps = videoTrack ? (await videoTrack.computePacketStats(120)).averagePacketRate : void 0;
    const width = videoTrack?.displayWidth;
    const height = videoTrack?.displayHeight;
    const tags = await input.getMetadataTags();
    const created = tags.date;
    const gps = findIso6709Location(tags.raw);
    return {
      codec,
      fps,
      width,
      height,
      startTime: created,
      timezoneOffsetMinutes: created ? 0 : void 0,
      // MP4 creation_time is UTC
      gps
    };
  } finally {
    const disposable = input;
    try {
      disposable[Symbol.dispose]?.();
    } catch {
    }
  }
}
function findIso6709Location(info) {
  const isoRegex = /([+-]\d{2,3}\.\d+)([+-]\d{2,3}\.\d+)/;
  const stack = [info];
  while (stack.length) {
    const current = stack.pop();
    if (!current) continue;
    if (typeof current === "string") {
      const match = current.match(isoRegex);
      if (match) {
        const lat = Number(match[1]);
        const lon = Number(match[2]);
        if (!Number.isNaN(lat) && !Number.isNaN(lon)) {
          return { lat, lon };
        }
      }
    } else if (Array.isArray(current)) {
      for (const item of current) stack.push(item);
    } else if (typeof current === "object") {
      for (const value of Object.values(current)) {
        stack.push(value);
      }
    }
  }
  return void 0;
}
function isWebCodecsSupported() {
  return typeof VideoDecoder !== "undefined" && typeof VideoEncoder !== "undefined" && typeof VideoFrame !== "undefined";
}
function isSharedArrayBufferSupported() {
  return typeof SharedArrayBuffer !== "undefined";
}
function checkBrowserCapabilities() {
  const missing = [];
  if (!isWebCodecsSupported()) {
    missing.push("WebCodecs API");
  }
  if (!isSharedArrayBufferSupported()) {
    missing.push("SharedArrayBuffer");
  }
  if (typeof OffscreenCanvas === "undefined") {
    missing.push("OffscreenCanvas");
  }
  return {
    supported: missing.length === 0,
    missing
  };
}

const PROGRESS_UPDATE_MIN_INTERVAL_MS = 120;
function createProcessingProgressReporter(onProgress, totalFrames) {
  let lastReportAt = 0;
  return {
    report(framesProcessed, force = false) {
      if (!onProgress) return;
      const now = typeof performance !== "undefined" ? performance.now() : Date.now();
      const percent = totalFrames > 0 ? Math.round(framesProcessed / totalFrames * 100) : 0;
      const shouldReport = force || framesProcessed === totalFrames || framesProcessed === 0 || now - lastReportAt >= PROGRESS_UPDATE_MIN_INTERVAL_MS;
      if (!shouldReport) return;
      lastReportAt = now;
      onProgress({
        phase: "processing",
        percent,
        framesProcessed,
        totalFrames
      });
    }
  };
}
function createMuxProgressReporter(onProgress, totalFrames) {
  return {
    report(percent, framesProcessed) {
      if (!onProgress) return;
      const safePercent = Math.max(0, Math.min(100, Math.round(percent)));
      onProgress({
        phase: "muxing",
        percent: safePercent,
        framesProcessed,
        totalFrames
      });
    }
  };
}
function createEtaCalculator$1(startedAtMs) {
  let smoothedEtaSeconds = null;
  return {
    update(currentPercent) {
      if (!startedAtMs || currentPercent <= 0 || currentPercent >= 100) {
        return void 0;
      }
      const elapsedSeconds = Math.max(0, (Date.now() - startedAtMs) / 1e3);
      const rawEtaSeconds = elapsedSeconds * ((100 - currentPercent) / currentPercent);
      smoothedEtaSeconds = smoothedEtaSeconds === null ? rawEtaSeconds : smoothedEtaSeconds * 0.7 + rawEtaSeconds * 0.3;
      return Math.max(0, Math.round(smoothedEtaSeconds));
    }
  };
}

function createEtaCalculator(startedAtMs) {
  const baseCalculator = createEtaCalculator$1(startedAtMs);
  return {
    update(currentPercent) {
      return baseCalculator.update(currentPercent);
    }
  };
}
function safeNumber(value, defaultValue) {
  return Number.isFinite(value) ? value : defaultValue;
}
function formatErrorMessage(err) {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  try {
    const serialized = JSON.stringify(err);
    return serialized === void 0 || serialized === "{}" ? "Unknown error" : serialized;
  } catch {
    return "Unknown error";
  }
}
function formatErrorDetails(details) {
  if (typeof details.details === "string") return details.details;
  try {
    return JSON.stringify(details, null, 2);
  } catch {
    return "";
  }
}
function normalizeProcessingError(err) {
  const error = err;
  if (error?.details) {
    const details = formatErrorDetails(error.details);
    return details ? `${error.message}

${details}` : error.message ?? "Unknown error";
  }
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  try {
    const serialized = JSON.stringify(err);
    return serialized === void 0 || serialized === "{}" ? "Unknown processing error" : serialized;
  } catch {
    return "Unknown processing error";
  }
}

const useFilesStore = defineStore("files", () => {
  const videoFile = ref(null);
  const gpxFile = ref(null);
  const videoMeta = ref(null);
  const gpxData = ref(null);
  const videoValidation = ref(null);
  const gpxValidation = ref(null);
  const isLoadingVideo = ref(false);
  const isLoadingGpx = ref(false);
  const error = ref(null);
  const hasVideo = computed(() => videoFile.value !== null && videoMeta.value !== null);
  const hasGpx = computed(() => gpxFile.value !== null && gpxData.value !== null);
  const isReady = computed(() => hasVideo.value && hasGpx.value);
  async function setVideoFile(file) {
    await loadFile({
      file,
      validate: validateVideoFile,
      parse: extractVideoMeta,
      onSuccess: (file2, meta) => {
        videoFile.value = file2;
        videoMeta.value = meta;
        videoValidation.value = enhanceVideoValidation(meta, videoValidation.value);
      },
      onError: () => {
        videoFile.value = null;
        videoMeta.value = null;
      },
      setLoading: (v) => {
        isLoadingVideo.value = v;
      },
      setError: (e) => {
        error.value = e;
      },
      setValidation: (v) => {
        videoValidation.value = v;
      }
    });
  }
  async function setGpxFile(file) {
    await loadFile({
      file,
      validate: validateGpxFile,
      parse: readAndParseGpx,
      onSuccess: (file2, data) => {
        gpxFile.value = file2;
        gpxData.value = data;
      },
      onError: () => {
        gpxFile.value = null;
        gpxData.value = null;
      },
      setLoading: (v) => {
        isLoadingGpx.value = v;
      },
      setError: (e) => {
        error.value = e;
      },
      setValidation: (v) => {
        gpxValidation.value = v;
      }
    });
  }
  function reset() {
    videoFile.value = null;
    gpxFile.value = null;
    videoMeta.value = null;
    gpxData.value = null;
    videoValidation.value = null;
    gpxValidation.value = null;
    isLoadingVideo.value = false;
    isLoadingGpx.value = false;
    error.value = null;
  }
  return {
    // State
    videoFile,
    gpxFile,
    videoMeta,
    gpxData,
    videoValidation,
    gpxValidation,
    isLoadingVideo,
    isLoadingGpx,
    error,
    // Computed
    hasVideo,
    hasGpx,
    isReady,
    // Actions
    setVideoFile,
    setGpxFile,
    reset
  };
});
async function loadFile({
  file,
  validate,
  parse,
  onSuccess,
  onError,
  setLoading,
  setError,
  setValidation
}) {
  setError(null);
  setLoading(true);
  try {
    const validation = validate(file);
    setValidation(validation);
    if (!validation.valid) {
      setError(validation.errors.join("; "));
      return;
    }
    const result = await parse(file);
    onSuccess(file, result);
  } catch (err) {
    setError(formatErrorMessage(err));
    onError();
  } finally {
    setLoading(false);
  }
}
function enhanceVideoValidation(meta, validation) {
  const warnings = [...validation?.warnings ?? []];
  if (meta.duration > WARN_DURATION_SECONDS) {
    warnings.push(
      `Video is longer than 30 minutes (${Math.round(meta.duration / 60)} min). Processing may take a long time.`
    );
  }
  return { valid: true, errors: [], warnings };
}

const EARTH_RADIUS_KM = 6371;
const MOVING_SPEED_THRESHOLD = 1;
const PACE_WINDOW_MIN_DISTANCE_KM = 8e-3;
const PACE_WINDOW_MIN_SECONDS = 3;
const PACE_WINDOW_MAX_SECONDS = 300;
const PACE_DISPLAY_WINDOW_SECONDS = 10;
function haversineDistance(lat1, lon1, lat2, lon2) {
  const toRad = (deg) => deg * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}
function calculateCumulativeDistances(points) {
  if (points.length === 0) return [];
  const distances = [0];
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const segmentDist = haversineDistance(prev.lat, prev.lon, curr.lat, curr.lon);
    distances.push(distances[i - 1] + segmentDist);
  }
  return distances;
}
function lerp(v0, v1, t) {
  return v0 + t * (v1 - v0);
}
function formatElapsedTime(totalSeconds) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor(totalSeconds % 3600 / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const pad = (n) => n.toString().padStart(2, "0");
  if (hours > 0) {
    return `${hours}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${minutes}:${pad(seconds)}`;
}
function formatPace(secondsPerKm) {
  if (secondsPerKm === void 0) return void 0;
  const roundedSeconds = Math.round(secondsPerKm);
  const minutes = Math.floor(roundedSeconds / 60);
  const seconds = roundedSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
function interpolateOptionalValue(before, after, t) {
  if (before !== void 0 && after !== void 0) {
    return lerp(before, after, t);
  }
  return before ?? after;
}
function interpolateDistanceAtTime(frames, targetTime) {
  if (frames.length === 0) return void 0;
  const first = frames[0];
  const last = frames[frames.length - 1];
  if (targetTime < first.timeOffset || targetTime > last.timeOffset) return void 0;
  let lo = 0;
  let hi = frames.length - 1;
  while (lo < hi - 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (frames[mid].timeOffset <= targetTime) {
      lo = mid;
    } else {
      hi = mid;
    }
  }
  const before = frames[lo];
  const after = frames[hi];
  if (before.timeOffset === after.timeOffset) {
    return before.distanceKm;
  }
  const t = (targetTime - before.timeOffset) / (after.timeOffset - before.timeOffset);
  return lerp(before.distanceKm, after.distanceKm, t);
}
function estimateDisplayPaceAtTime(frames, gpxTime) {
  if (frames.length === 0) return void 0;
  const first = frames[0];
  const last = frames[frames.length - 1];
  if (gpxTime < first.timeOffset || gpxTime > last.timeOffset) return void 0;
  const sampledSecond = Math.floor(gpxTime);
  const halfWindow = PACE_DISPLAY_WINDOW_SECONDS / 2;
  const centeredStart = Math.max(first.timeOffset, sampledSecond - halfWindow);
  const centeredEnd = Math.min(last.timeOffset, sampledSecond + halfWindow);
  const tryEstimate = (startTime, endTime) => {
    const elapsedSec = endTime - startTime;
    if (elapsedSec < PACE_WINDOW_MIN_SECONDS) return void 0;
    const startDist = interpolateDistanceAtTime(frames, startTime);
    const endDist = interpolateDistanceAtTime(frames, endTime);
    if (startDist === void 0 || endDist === void 0) return void 0;
    const distKm = endDist - startDist;
    if (distKm < PACE_WINDOW_MIN_DISTANCE_KM) return void 0;
    const paceSecPerKm = elapsedSec / distKm;
    if (paceSecPerKm < 120 || paceSecPerKm > 1800) return void 0;
    return paceSecPerKm;
  };
  const centeredPace = tryEstimate(centeredStart, centeredEnd);
  if (centeredPace !== void 0) return centeredPace;
  const backwardStart = Math.max(first.timeOffset, sampledSecond - PACE_DISPLAY_WINDOW_SECONDS);
  const backwardPace = tryEstimate(backwardStart, sampledSecond);
  if (backwardPace !== void 0) return backwardPace;
  const forwardEnd = Math.min(last.timeOffset, sampledSecond + PACE_DISPLAY_WINDOW_SECONDS);
  return tryEstimate(sampledSecond, forwardEnd);
}
function fillMissingPaceValues(values) {
  if (values.length === 0) return values;
  const result = [...values];
  const validIndices = [];
  for (let i = 0; i < result.length; i++) {
    if (result[i] !== void 0) {
      validIndices.push(i);
    }
  }
  if (validIndices.length === 0) {
    return result;
  }
  const firstValidIdx = validIndices[0];
  const firstValue = result[firstValidIdx];
  for (let i = 0; i < firstValidIdx; i++) {
    result[i] = firstValue;
  }
  for (let k = 0; k < validIndices.length - 1; k++) {
    const left = validIndices[k];
    const right = validIndices[k + 1];
    const leftValue = result[left];
    const rightValue = result[right];
    for (let i = left + 1; i < right; i++) {
      const t = (i - left) / (right - left);
      result[i] = lerp(leftValue, rightValue, t);
    }
  }
  const lastValidIdx = validIndices[validIndices.length - 1];
  const lastValue = result[lastValidIdx];
  for (let i = lastValidIdx + 1; i < result.length; i++) {
    result[i] = lastValue;
  }
  return result;
}
function estimateRollingPaceAtIndex(points, distances, index) {
  const point = points[index];
  if (!point) return void 0;
  const currTimeMs = point.time.getTime();
  const currDistKm = distances[index];
  for (let j = index - 1; j >= 0; j--) {
    const prevPoint = points[j];
    const dtSec = (currTimeMs - prevPoint.time.getTime()) / 1e3;
    if (dtSec > PACE_WINDOW_MAX_SECONDS) break;
    if (dtSec < PACE_WINDOW_MIN_SECONDS) continue;
    const distKm = currDistKm - distances[j];
    if (distKm < PACE_WINDOW_MIN_DISTANCE_KM) continue;
    const pace = dtSec / distKm;
    if (pace >= 120 && pace <= 1800) return pace;
  }
  for (let j = index + 1; j < points.length; j++) {
    const nextPoint = points[j];
    const dtSec = (nextPoint.time.getTime() - currTimeMs) / 1e3;
    if (dtSec > PACE_WINDOW_MAX_SECONDS) break;
    if (dtSec < PACE_WINDOW_MIN_SECONDS) continue;
    const distKm = distances[j] - currDistKm;
    if (distKm < PACE_WINDOW_MIN_DISTANCE_KM) continue;
    const pace = dtSec / distKm;
    if (pace >= 120 && pace <= 1800) return pace;
  }
  return void 0;
}
function buildTelemetryTimeline(points) {
  if (points.length === 0) return [];
  const distances = calculateCumulativeDistances(points);
  const startTime = points[0].time.getTime();
  const frames = [];
  let movingTimeMs = 0;
  for (let i = 0; i < points.length; i++) {
    const point = points[i];
    const timeOffset = (point.time.getTime() - startTime) / 1e3;
    let pace;
    if (i > 0) {
      const prevPoint = points[i - 1];
      const prevDist = distances[i - 1];
      const currDist = distances[i];
      pace = estimateRollingPaceAtIndex(points, distances, i);
      const segmentDist = currDist - prevDist;
      const segmentTime = (point.time.getTime() - prevPoint.time.getTime()) / 1e3;
      if (segmentTime > 0) {
        const speedKmh = segmentDist / segmentTime * 3600;
        if (speedKmh >= MOVING_SPEED_THRESHOLD) {
          movingTimeMs += point.time.getTime() - prevPoint.time.getTime();
        }
      }
    }
    frames.push({
      timeOffset,
      hr: point.hr,
      paceSecondsPerKm: pace,
      distanceKm: distances[i],
      elevationM: point.ele,
      elapsedTime: formatElapsedTime(timeOffset),
      movingTimeSeconds: movingTimeMs / 1e3
    });
  }
  const smoothedPace = fillMissingPaceValues(frames.map((frame) => frame.paceSecondsPerKm));
  for (let i = 0; i < frames.length; i++) {
    frames[i].paceSecondsPerKm = smoothedPace[i];
  }
  return frames;
}
function getTelemetryAtTime(frames, videoTimeSeconds, syncOffsetSeconds) {
  if (frames.length === 0) return null;
  if (!Number.isFinite(videoTimeSeconds) || !Number.isFinite(syncOffsetSeconds)) return null;
  const gpxTime = videoTimeSeconds + syncOffsetSeconds;
  if (!Number.isFinite(gpxTime)) return null;
  const firstFrame = frames[0];
  const lastFrame = frames[frames.length - 1];
  if (gpxTime < firstFrame.timeOffset || gpxTime > lastFrame.timeOffset) {
    return null;
  }
  let lo = 0;
  let hi = frames.length - 1;
  while (lo < hi - 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (frames[mid].timeOffset <= gpxTime) {
      lo = mid;
    } else {
      hi = mid;
    }
  }
  const beforeFrame = frames[lo];
  const afterFrame = frames[hi];
  if (lo === hi || afterFrame.timeOffset === beforeFrame.timeOffset) {
    return beforeFrame;
  }
  const t = (gpxTime - beforeFrame.timeOffset) / (afterFrame.timeOffset - beforeFrame.timeOffset);
  const interpolatedHr = beforeFrame.hr !== void 0 && afterFrame.hr !== void 0 ? Math.round(lerp(beforeFrame.hr, afterFrame.hr, t)) : beforeFrame.hr ?? afterFrame.hr;
  const interpolatedPace = estimateDisplayPaceAtTime(frames, gpxTime) ?? interpolateOptionalValue(
    beforeFrame.paceSecondsPerKm,
    afterFrame.paceSecondsPerKm,
    t
  );
  const interpolatedDist = lerp(beforeFrame.distanceKm, afterFrame.distanceKm, t);
  const interpolatedMovingTime = lerp(beforeFrame.movingTimeSeconds, afterFrame.movingTimeSeconds, t);
  const interpolatedElevation = beforeFrame.elevationM !== void 0 && afterFrame.elevationM !== void 0 ? lerp(beforeFrame.elevationM, afterFrame.elevationM, t) : beforeFrame.elevationM ?? afterFrame.elevationM;
  return {
    timeOffset: gpxTime,
    hr: interpolatedHr,
    paceSecondsPerKm: interpolatedPace,
    distanceKm: interpolatedDist,
    elevationM: interpolatedElevation,
    elapsedTime: formatElapsedTime(gpxTime),
    movingTimeSeconds: interpolatedMovingTime
  };
}

const MAX_AUTO_OFFSET_SECONDS = 300;
const MANUAL_SYNC_RANGE_SECONDS = 1800;
function getSyncRangeSeconds(videoDurationSeconds) {
  if (!Number.isFinite(videoDurationSeconds) || (videoDurationSeconds ?? 0) <= 0) {
    return MANUAL_SYNC_RANGE_SECONDS;
  }
  return Math.min(MANUAL_SYNC_RANGE_SECONDS, Math.max(1, Math.round(videoDurationSeconds)));
}
function autoSync(gpxPoints, videoStartTime, videoStartLat, videoStartLon, videoTimezoneOffsetMinutes) {
  if (gpxPoints.length === 0) {
    throw new SyncError("No track points for synchronization");
  }
  if (videoStartLat !== void 0 && videoStartLon !== void 0) {
    return syncByGpsCoordinates(gpxPoints, videoStartLat, videoStartLon);
  }
  if (videoStartTime) {
    return syncByTime(gpxPoints, videoStartTime);
  }
  return {
    offsetSeconds: 0,
    autoSynced: false,
    warning: "Auto-sync is not possible without GPS or the video start time."
  };
}
function syncByGpsCoordinates(gpxPoints, lat, lon) {
  let minDist = Infinity;
  let closestIdx = 0;
  for (let i = 0; i < gpxPoints.length; i++) {
    const point = gpxPoints[i];
    const dist = haversineDistance(lat, lon, point.lat, point.lon);
    if (dist < minDist) {
      minDist = dist;
      closestIdx = i;
    }
  }
  const closestPoint = gpxPoints[closestIdx];
  const gpxStartTime = gpxPoints[0].time.getTime();
  const closestTime = closestPoint.time.getTime();
  const offsetSeconds = (closestTime - gpxStartTime) / 1e3;
  return {
    offsetSeconds,
    autoSynced: true
  };
}
function syncByTime(gpxPoints, videoTime, _videoTimezoneOffsetMinutes) {
  const videoMs = videoTime.getTime();
  const gpxStartMs = gpxPoints[0].time.getTime();
  const offsetMs = videoMs - gpxStartMs;
  const offsetSeconds = offsetMs / 1e3;
  if (Math.abs(offsetSeconds) > MAX_AUTO_OFFSET_SECONDS) {
    return {
      offsetSeconds,
      autoSynced: true,
      // Still auto-sync, but with warning
      warning: `Large time difference: ${formatTimeDiff(offsetSeconds)}. Auto-sync was applied — please verify manually.`
    };
  }
  return {
    offsetSeconds,
    autoSynced: true
  };
}
function formatTimeDiff(seconds) {
  const totalSeconds = Math.max(0, Math.round(Math.abs(seconds)));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor(totalSeconds % 3600 / 60);
  const secs = totalSeconds % 60;
  const parts = [];
  if (hours > 0) parts.push(`${hours} h`);
  if (minutes > 0) parts.push(`${minutes} min`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs} sec`);
  return parts.join(" ");
}

const DEFAULT_SYNC_CONFIG = {
  offsetSeconds: 0,
  autoSynced: false
};
const useSyncStore = defineStore("sync", () => {
  const syncConfig = ref({ ...DEFAULT_SYNC_CONFIG });
  const isAutoSyncing = ref(false);
  const syncError = ref(null);
  const syncWarning = ref(null);
  const manualOverrideActive = ref(false);
  const offsetSeconds = computed(() => syncConfig.value.offsetSeconds);
  const isAutoSynced = computed(() => syncConfig.value.autoSynced);
  function setManualOffset(seconds, _videoDurationSeconds) {
    const safeSeconds = safeNumber(seconds, 0);
    syncConfig.value = {
      offsetSeconds: safeSeconds,
      autoSynced: false
    };
    manualOverrideActive.value = true;
    syncError.value = null;
  }
  async function performAutoSync(gpxPoints, videoStartTime, videoStartLat, videoStartLon, videoTimezoneOffsetMinutes, allowOverrideManual = false, _videoDurationSeconds) {
    if (manualOverrideActive.value && !allowOverrideManual) {
      return;
    }
    isAutoSyncing.value = true;
    syncError.value = null;
    syncWarning.value = null;
    try {
      const result = autoSync(
        gpxPoints,
        videoStartTime,
        videoStartLat,
        videoStartLon,
        videoTimezoneOffsetMinutes
      );
      syncConfig.value = result;
      manualOverrideActive.value = false;
      if (result.warning) {
        syncWarning.value = result.warning;
      }
      if (!result.autoSynced) {
        syncError.value = "Auto-sync failed. Use manual adjustment.";
      }
    } catch (err) {
      syncError.value = formatErrorMessage(err);
      syncConfig.value = { ...DEFAULT_SYNC_CONFIG };
    } finally {
      isAutoSyncing.value = false;
    }
  }
  function reset() {
    syncConfig.value = { ...DEFAULT_SYNC_CONFIG };
    isAutoSyncing.value = false;
    syncError.value = null;
    syncWarning.value = null;
    manualOverrideActive.value = false;
  }
  return {
    syncConfig,
    isAutoSyncing,
    syncError,
    syncWarning,
    offsetSeconds,
    isAutoSynced,
    setManualOffset,
    performAutoSync,
    reset
  };
});

const PHASE_PERCENT_RANGES = {
  demuxing: { min: 0, max: 5 },
  encoding: { min: 5, max: 85 },
  processing: { min: 5, max: 92 },
  muxing: { min: 92, max: 99 },
  complete: { min: 100, max: 100 }
};
const useProcessingStore = defineStore("processing", () => {
  const isProcessing = ref(false);
  const progress = ref(createInitialProgress());
  const resultBlob = ref(null);
  const resultUrl = ref(null);
  const processingError = ref(null);
  const startedAtMs = ref(null);
  const etaCalculator = ref(null);
  const isComplete = computed(() => progress.value.phase === "complete");
  const hasResult = computed(() => resultBlob.value !== null);
  const progressPercent = computed(() => progress.value.percent);
  function startProcessing(totalFrames) {
    isProcessing.value = true;
    processingError.value = null;
    startedAtMs.value = Date.now();
    etaCalculator.value = createEtaCalculator(startedAtMs.value);
    resultBlob.value = null;
    if (resultUrl.value) {
      URL.revokeObjectURL(resultUrl.value);
      resultUrl.value = null;
    }
    progress.value = {
      phase: "demuxing",
      percent: 0,
      framesProcessed: 0,
      totalFrames
    };
  }
  function updateProgress(update) {
    const mappedPercent = calculateMappedPercent(update.phase, update.percent);
    const safePercent = calculateSafePercent(update.phase, mappedPercent, progress.value.percent);
    const estimatedRemainingSeconds = calculateEta(
      safePercent,
      update.estimatedRemainingSeconds,
      etaCalculator.value
    );
    progress.value = {
      ...update,
      percent: safePercent,
      estimatedRemainingSeconds
    };
  }
  function setResult(blob) {
    resultBlob.value = blob;
    resultUrl.value = URL.createObjectURL(blob);
    progress.value = {
      ...progress.value,
      phase: "complete",
      percent: 100,
      estimatedRemainingSeconds: 0
    };
    isProcessing.value = false;
  }
  function setError(message) {
    processingError.value = message;
    isProcessing.value = false;
  }
  function cancelProcessing() {
    resetProcessingState();
  }
  function reset() {
    if (resultUrl.value) {
      URL.revokeObjectURL(resultUrl.value);
    }
    resetProcessingState();
  }
  function resetProcessingState() {
    isProcessing.value = false;
    processingError.value = null;
    startedAtMs.value = null;
    etaCalculator.value = null;
    resultBlob.value = null;
    resultUrl.value = null;
    progress.value = createInitialProgress();
  }
  return {
    isProcessing,
    progress,
    resultBlob,
    resultUrl,
    processingError,
    isComplete,
    hasResult,
    progressPercent,
    startProcessing,
    updateProgress,
    setResult,
    setError,
    cancelProcessing,
    reset
  };
});
function createInitialProgress() {
  return {
    phase: "demuxing",
    percent: 0,
    framesProcessed: 0,
    totalFrames: 0
  };
}
function calculateMappedPercent(phase, rawPercent) {
  if (phase === "complete") return 100;
  const { min, max } = PHASE_PERCENT_RANGES[phase];
  const normalized = Math.max(0, Math.min(100, rawPercent)) / 100;
  return Math.round(min + (max - min) * normalized);
}
function calculateSafePercent(phase, mappedPercent, previousPercent) {
  return phase === "complete" ? 100 : Math.min(99, Math.max(previousPercent, mappedPercent));
}
function calculateEta(currentPercent, providedEta, calculator) {
  if (Number.isFinite(providedEta)) {
    return providedEta;
  }
  return calculator?.update(currentPercent);
}

const horizonTemplate = {
  id: "horizon",
  metadata: {
    id: "horizon",
    name: "Horizon",
    description: "Bottom bar with gradient overlay and horizontal metric layout",
    previewColors: { bg: "#0a0a0a", accent: "#ffffff", text: "#ffffff" }
  },
  config: {
    templateId: "horizon",
    layoutMode: "bottom-bar",
    position: "bottom-left",
    backgroundOpacity: 0.85,
    fontSizePercent: 2.4,
    showHr: true,
    showPace: true,
    showDistance: true,
    showTime: true,
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    textColor: "#FFFFFF",
    backgroundColor: "#000000",
    borderWidth: 0,
    borderColor: "transparent",
    cornerRadius: 0,
    textShadow: false,
    textShadowColor: "#000000",
    textShadowBlur: 0,
    lineSpacing: 1.2,
    layout: "horizontal",
    iconStyle: "none",
    gradientBackground: true,
    gradientStartColor: "rgba(0,0,0,0)",
    gradientEndColor: "rgba(0,0,0,0.9)",
    labelStyle: "uppercase",
    valueFontWeight: "bold",
    valueSizeMultiplier: 2.5,
    labelSizeMultiplier: 0.4,
    labelLetterSpacing: 0.15,
    accentColor: "#ef4444"
  }
};

const marginTemplate = {
  id: "margin",
  metadata: {
    id: "margin",
    name: "Margin",
    description: "Large typography on left and right margins with vertical labels",
    previewColors: { bg: "#111111", accent: "#ef4444", text: "#ffffff" }
  },
  config: {
    templateId: "margin",
    layoutMode: "side-margins",
    position: "bottom-left",
    backgroundOpacity: 0.6,
    fontSizePercent: 2,
    showHr: true,
    showPace: true,
    showDistance: true,
    showTime: true,
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    textColor: "#FFFFFF",
    backgroundColor: "#000000",
    borderWidth: 0,
    borderColor: "transparent",
    cornerRadius: 0,
    textShadow: true,
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowBlur: 8,
    lineSpacing: 1.2,
    layout: "vertical",
    iconStyle: "none",
    gradientBackground: false,
    gradientStartColor: "#000000",
    gradientEndColor: "#333333",
    labelStyle: "uppercase",
    valueFontWeight: "light",
    valueSizeMultiplier: 3.5,
    labelSizeMultiplier: 0.35,
    labelLetterSpacing: 0.25,
    accentColor: "#ef4444"
  }
};

const lframeTemplate = {
  id: "l-frame",
  metadata: {
    id: "l-frame",
    name: "L-Frame",
    description: "Minimalist L-shaped frame with clean metric alignment",
    previewColors: { bg: "#1a1a2e", accent: "#ffffff", text: "#f0f0f0" }
  },
  config: {
    templateId: "l-frame",
    layoutMode: "corner-frame",
    position: "bottom-left",
    backgroundOpacity: 0,
    fontSizePercent: 2,
    showHr: true,
    showPace: true,
    showDistance: true,
    showTime: true,
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    textColor: "#FFFFFF",
    backgroundColor: "transparent",
    borderWidth: 0,
    borderColor: "transparent",
    cornerRadius: 0,
    textShadow: true,
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowBlur: 6,
    lineSpacing: 1,
    layout: "horizontal",
    iconStyle: "none",
    gradientBackground: false,
    gradientStartColor: "#000000",
    gradientEndColor: "#333333",
    labelStyle: "uppercase",
    valueFontWeight: "light",
    valueSizeMultiplier: 3,
    labelSizeMultiplier: 0.4,
    labelLetterSpacing: 0.15,
    accentColor: "#ffffff"
  }
};

const classicTemplate = {
  id: "classic",
  metadata: {
    id: "classic",
    name: "Classic",
    description: "Simple positioned overlay with rounded rectangle background",
    previewColors: { bg: "#000000", accent: "#646cff", text: "#ffffff" }
  },
  config: {
    templateId: "classic",
    layoutMode: "box",
    position: "top-right",
    backgroundOpacity: 0,
    fontSizePercent: 2,
    showHr: true,
    showPace: true,
    showDistance: true,
    showTime: true,
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    textColor: "#FFFFFF",
    backgroundColor: "transparent",
    borderWidth: 0,
    borderColor: "#FFFFFF",
    cornerRadius: 4,
    textShadow: false,
    textShadowColor: "#000000",
    textShadowBlur: 2,
    lineSpacing: 1.2,
    layout: "vertical",
    iconStyle: "outline",
    gradientBackground: false,
    gradientStartColor: "#000000",
    gradientEndColor: "#333333",
    labelStyle: "hidden",
    valueFontWeight: "bold",
    valueSizeMultiplier: 1,
    labelSizeMultiplier: 0.5,
    labelLetterSpacing: 0.1,
    accentColor: "#646cff"
  }
};

const floatingPillsTemplate = {
  id: "floating-pills",
  metadata: {
    id: "floating-pills",
    name: "Floating Pills",
    description: "Floating glass-like pills centered at the bottom",
    previewColors: { bg: "#131a2a", accent: "#a5b4fc", text: "#ffffff" }
  },
  config: {
    templateId: "floating-pills",
    layoutMode: "floating-pills",
    position: "bottom-left",
    backgroundOpacity: 0.2,
    fontSizePercent: 2.1,
    showHr: true,
    showPace: true,
    showDistance: true,
    showTime: true,
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    textColor: "#FFFFFF",
    backgroundColor: "rgba(255,255,255,0.15)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    cornerRadius: 50,
    textShadow: false,
    textShadowColor: "#000000",
    textShadowBlur: 0,
    lineSpacing: 1.2,
    layout: "horizontal",
    iconStyle: "none",
    gradientBackground: false,
    gradientStartColor: "#000000",
    gradientEndColor: "#333333",
    labelStyle: "uppercase",
    valueFontWeight: "normal",
    valueSizeMultiplier: 1.1,
    labelSizeMultiplier: 0.45,
    labelLetterSpacing: 0.12,
    accentColor: "#a5b4fc"
  }
};

const arcGaugeTemplate = {
  id: "arc-gauge",
  metadata: {
    id: "arc-gauge",
    name: "Arc Gauge",
    description: "Pace-focused arc gauge with secondary side metrics",
    previewColors: { bg: "#0a0f1f", accent: "#ffffff", text: "#e5e7eb" }
  },
  config: {
    templateId: "arc-gauge",
    layoutMode: "arc-gauge",
    position: "top-left",
    backgroundOpacity: 0,
    fontSizePercent: 2.2,
    showHr: true,
    showPace: true,
    showDistance: true,
    showTime: true,
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    textColor: "#FFFFFF",
    backgroundColor: "transparent",
    borderWidth: 0,
    borderColor: "transparent",
    cornerRadius: 0,
    textShadow: true,
    textShadowColor: "rgba(0,0,0,0.45)",
    textShadowBlur: 6,
    lineSpacing: 1.1,
    layout: "horizontal",
    iconStyle: "none",
    gradientBackground: false,
    gradientStartColor: "#000000",
    gradientEndColor: "#333333",
    labelStyle: "uppercase",
    valueFontWeight: "light",
    valueSizeMultiplier: 1.8,
    labelSizeMultiplier: 0.45,
    labelLetterSpacing: 0.18,
    accentColor: "#ffffff"
  }
};

const heroNumberTemplate = {
  id: "hero-number",
  metadata: {
    id: "hero-number",
    name: "Hero Number",
    description: "Large pace number with compact secondary metrics",
    previewColors: { bg: "#111827", accent: "#f8fafc", text: "#ffffff" }
  },
  config: {
    templateId: "hero-number",
    layoutMode: "hero-number",
    position: "top-left",
    backgroundOpacity: 0,
    fontSizePercent: 2.3,
    showHr: true,
    showPace: true,
    showDistance: true,
    showTime: true,
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    textColor: "#FFFFFF",
    backgroundColor: "transparent",
    borderWidth: 0,
    borderColor: "transparent",
    cornerRadius: 0,
    textShadow: true,
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowBlur: 14,
    lineSpacing: 1.1,
    layout: "horizontal",
    iconStyle: "none",
    gradientBackground: false,
    gradientStartColor: "#000000",
    gradientEndColor: "#333333",
    labelStyle: "uppercase",
    valueFontWeight: "bold",
    valueSizeMultiplier: 2.8,
    labelSizeMultiplier: 0.5,
    labelLetterSpacing: 0.25,
    accentColor: "#FFFFFF"
  }
};

const dashboardHudTemplate = {
  id: "dashboard-hud",
  metadata: {
    id: "dashboard-hud",
    name: "Dashboard HUD",
    description: "Cockpit-inspired split telemetry HUD",
    previewColors: { bg: "#091016", accent: "#ef4444", text: "#e2e8f0" }
  },
  config: {
    templateId: "dashboard-hud",
    layoutMode: "dashboard-hud",
    position: "top-left",
    backgroundOpacity: 0,
    fontSizePercent: 2,
    showHr: true,
    showPace: true,
    showDistance: true,
    showTime: true,
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    textColor: "#FFFFFF",
    backgroundColor: "transparent",
    borderWidth: 0,
    borderColor: "transparent",
    cornerRadius: 0,
    textShadow: true,
    textShadowColor: "rgba(0,0,0,0.55)",
    textShadowBlur: 5,
    lineSpacing: 1.2,
    layout: "horizontal",
    iconStyle: "none",
    gradientBackground: false,
    gradientStartColor: "#000000",
    gradientEndColor: "#333333",
    labelStyle: "uppercase",
    valueFontWeight: "light",
    valueSizeMultiplier: 1.7,
    labelSizeMultiplier: 0.42,
    labelLetterSpacing: 0.2,
    accentColor: "#ef4444"
  }
};

const cinematicBarTemplate = {
  id: "cinematic-bar",
  metadata: {
    id: "cinematic-bar",
    name: "Cinematic Bar",
    description: "Letterbox bars with compact bottom telemetry strip",
    previewColors: { bg: "#000000", accent: "#ffffff", text: "#f8fafc" }
  },
  config: {
    templateId: "cinematic-bar",
    layoutMode: "cinematic-bar",
    position: "bottom-left",
    backgroundOpacity: 0.6,
    fontSizePercent: 1.85,
    showHr: true,
    showPace: true,
    showDistance: true,
    showTime: true,
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    textColor: "#FFFFFF",
    backgroundColor: "#000000",
    borderWidth: 0,
    borderColor: "transparent",
    cornerRadius: 0,
    textShadow: false,
    textShadowColor: "#000000",
    textShadowBlur: 0,
    lineSpacing: 1.15,
    layout: "horizontal",
    iconStyle: "none",
    gradientBackground: false,
    gradientStartColor: "#000000",
    gradientEndColor: "#333333",
    labelStyle: "uppercase",
    valueFontWeight: "normal",
    valueSizeMultiplier: 1.05,
    labelSizeMultiplier: 0.42,
    labelLetterSpacing: 0.16,
    accentColor: "#FFFFFF"
  }
};

const splitEdgesTemplate = {
  id: "split-edges",
  metadata: {
    id: "split-edges",
    name: "Split Edges",
    description: "Metrics split across video corners with center marker",
    previewColors: { bg: "#0f172a", accent: "#ef4444", text: "#f1f5f9" }
  },
  config: {
    templateId: "split-edges",
    layoutMode: "split-edges",
    position: "top-left",
    backgroundOpacity: 0.1,
    fontSizePercent: 2,
    showHr: true,
    showPace: true,
    showDistance: true,
    showTime: true,
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    textColor: "#FFFFFF",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    cornerRadius: 8,
    textShadow: true,
    textShadowColor: "rgba(0,0,0,0.45)",
    textShadowBlur: 6,
    lineSpacing: 1.2,
    layout: "vertical",
    iconStyle: "none",
    gradientBackground: false,
    gradientStartColor: "#000000",
    gradientEndColor: "#333333",
    labelStyle: "uppercase",
    valueFontWeight: "light",
    valueSizeMultiplier: 1.8,
    labelSizeMultiplier: 0.42,
    labelLetterSpacing: 0.18,
    accentColor: "#ef4444"
  }
};

const stackedSerifTemplate = {
  id: "stacked-serif",
  metadata: {
    id: "stacked-serif",
    name: "Stacked Serif",
    description: "Vertical serif stack with understated labels",
    previewColors: { bg: "#111111", accent: "#d4d4d8", text: "#ffffff" }
  },
  config: {
    templateId: "stacked-serif",
    layoutMode: "stacked-serif",
    position: "bottom-left",
    backgroundOpacity: 0,
    fontSizePercent: 2,
    showHr: true,
    showPace: true,
    showDistance: true,
    showTime: true,
    fontFamily: '"Georgia", "Times New Roman", serif',
    textColor: "#FFFFFF",
    backgroundColor: "transparent",
    borderWidth: 0,
    borderColor: "transparent",
    cornerRadius: 0,
    textShadow: true,
    textShadowColor: "rgba(0,0,0,0.45)",
    textShadowBlur: 4,
    lineSpacing: 1.1,
    layout: "vertical",
    iconStyle: "none",
    gradientBackground: false,
    gradientStartColor: "#000000",
    gradientEndColor: "#333333",
    labelStyle: "hidden",
    valueFontWeight: "normal",
    valueSizeMultiplier: 1.7,
    labelSizeMultiplier: 0.38,
    labelLetterSpacing: 0.12,
    accentColor: "#e5e7eb"
  }
};

const editorialTemplate = {
  id: "editorial",
  metadata: {
    id: "editorial",
    name: "Editorial",
    description: "Magazine-inspired serif hero pace with small side stats",
    previewColors: { bg: "#121212", accent: "#d1d5db", text: "#f8fafc" }
  },
  config: {
    templateId: "editorial",
    layoutMode: "editorial",
    position: "bottom-left",
    backgroundOpacity: 0,
    fontSizePercent: 2.1,
    showHr: true,
    showPace: true,
    showDistance: true,
    showTime: true,
    fontFamily: '"Georgia", "Times New Roman", serif',
    textColor: "#FFFFFF",
    backgroundColor: "transparent",
    borderWidth: 0,
    borderColor: "transparent",
    cornerRadius: 0,
    textShadow: true,
    textShadowColor: "rgba(0,0,0,0.35)",
    textShadowBlur: 3,
    lineSpacing: 1.1,
    layout: "vertical",
    iconStyle: "none",
    gradientBackground: false,
    gradientStartColor: "#000000",
    gradientEndColor: "#333333",
    labelStyle: "uppercase",
    valueFontWeight: "normal",
    valueSizeMultiplier: 2.2,
    labelSizeMultiplier: 0.34,
    labelLetterSpacing: 0.2,
    accentColor: "#e5e7eb"
  }
};

const tickerTapeTemplate = {
  id: "ticker-tape",
  metadata: {
    id: "ticker-tape",
    name: "Ticker Tape",
    description: "Live ticker strip at the bottom edge",
    previewColors: { bg: "#0a0a0a", accent: "#ef4444", text: "#f8fafc" }
  },
  config: {
    templateId: "ticker-tape",
    layoutMode: "ticker-tape",
    position: "bottom-left",
    backgroundOpacity: 0.95,
    fontSizePercent: 1.7,
    showHr: true,
    showPace: true,
    showDistance: true,
    showTime: true,
    fontFamily: '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
    textColor: "#FFFFFF",
    backgroundColor: "#000000",
    borderWidth: 0,
    borderColor: "transparent",
    cornerRadius: 0,
    textShadow: false,
    textShadowColor: "#000000",
    textShadowBlur: 0,
    lineSpacing: 1.2,
    layout: "horizontal",
    iconStyle: "none",
    gradientBackground: false,
    gradientStartColor: "#000000",
    gradientEndColor: "#333333",
    labelStyle: "hidden",
    valueFontWeight: "normal",
    valueSizeMultiplier: 1,
    labelSizeMultiplier: 0.4,
    labelLetterSpacing: 0.12,
    accentColor: "#ef4444"
  }
};

const whisperTemplate = {
  id: "whisper",
  metadata: {
    id: "whisper",
    name: "Whisper",
    description: "Ultra-subtle and low-contrast corner telemetry",
    previewColors: { bg: "#101218", accent: "#9ca3af", text: "#e5e7eb" }
  },
  config: {
    templateId: "whisper",
    layoutMode: "whisper",
    position: "bottom-right",
    backgroundOpacity: 0,
    fontSizePercent: 1.5,
    showHr: true,
    showPace: true,
    showDistance: true,
    showTime: true,
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    textColor: "rgba(255,255,255,0.28)",
    backgroundColor: "transparent",
    borderWidth: 0,
    borderColor: "transparent",
    cornerRadius: 0,
    textShadow: false,
    textShadowColor: "#000000",
    textShadowBlur: 0,
    lineSpacing: 1.05,
    layout: "vertical",
    iconStyle: "none",
    gradientBackground: false,
    gradientStartColor: "#000000",
    gradientEndColor: "#333333",
    labelStyle: "hidden",
    valueFontWeight: "light",
    valueSizeMultiplier: 0.95,
    labelSizeMultiplier: 0.32,
    labelLetterSpacing: 0.08,
    accentColor: "#9ca3af"
  }
};

const twoToneTemplate = {
  id: "two-tone",
  metadata: {
    id: "two-tone",
    name: "Two Tone",
    description: "High-contrast split typography with accent pace",
    previewColors: { bg: "#050505", accent: "#c8ff00", text: "#f8fafc" }
  },
  config: {
    templateId: "two-tone",
    layoutMode: "two-tone",
    position: "bottom-left",
    backgroundOpacity: 0,
    fontSizePercent: 2.2,
    showHr: true,
    showPace: true,
    showDistance: true,
    showTime: true,
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    textColor: "#FFFFFF",
    backgroundColor: "transparent",
    borderWidth: 0,
    borderColor: "transparent",
    cornerRadius: 0,
    textShadow: true,
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowBlur: 8,
    lineSpacing: 1.1,
    layout: "vertical",
    iconStyle: "none",
    gradientBackground: false,
    gradientStartColor: "#000000",
    gradientEndColor: "#333333",
    labelStyle: "uppercase",
    valueFontWeight: "bold",
    valueSizeMultiplier: 2.4,
    labelSizeMultiplier: 0.36,
    labelLetterSpacing: 0.22,
    accentColor: "#c8ff00"
  }
};

const condensedStripTemplate = {
  id: "condensed-strip",
  metadata: {
    id: "condensed-strip",
    name: "Condensed Strip",
    description: "Dense horizontal strip for compact telemetry",
    previewColors: { bg: "#ffffff", accent: "#111111", text: "#111111" }
  },
  config: {
    templateId: "condensed-strip",
    layoutMode: "condensed-strip",
    position: "bottom-left",
    backgroundOpacity: 1,
    fontSizePercent: 1.75,
    showHr: true,
    showPace: true,
    showDistance: true,
    showTime: true,
    fontFamily: '"Arial Narrow", "Helvetica Neue", Arial, sans-serif',
    textColor: "#111111",
    backgroundColor: "#FFFFFF",
    borderWidth: 0,
    borderColor: "transparent",
    cornerRadius: 0,
    textShadow: false,
    textShadowColor: "#000000",
    textShadowBlur: 0,
    lineSpacing: 1,
    layout: "horizontal",
    iconStyle: "none",
    gradientBackground: false,
    gradientStartColor: "#ffffff",
    gradientEndColor: "#ffffff",
    labelStyle: "uppercase",
    valueFontWeight: "bold",
    valueSizeMultiplier: 1.15,
    labelSizeMultiplier: 0.45,
    labelLetterSpacing: 0.08,
    accentColor: "#111111"
  }
};

const softRoundedTemplate = {
  id: "soft-rounded",
  metadata: {
    id: "soft-rounded",
    name: "Soft Rounded",
    description: "Rounded soft cards with gentle contrast",
    previewColors: { bg: "#f8fafc", accent: "#fb7185", text: "#111827" }
  },
  config: {
    templateId: "soft-rounded",
    layoutMode: "soft-rounded",
    position: "bottom-left",
    backgroundOpacity: 0.9,
    fontSizePercent: 1.95,
    showHr: true,
    showPace: true,
    showDistance: true,
    showTime: true,
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    textColor: "#111827",
    backgroundColor: "rgba(255,255,255,0.92)",
    borderWidth: 0,
    borderColor: "transparent",
    cornerRadius: 20,
    textShadow: false,
    textShadowColor: "#000000",
    textShadowBlur: 0,
    lineSpacing: 1.1,
    layout: "horizontal",
    iconStyle: "none",
    gradientBackground: false,
    gradientStartColor: "#ffffff",
    gradientEndColor: "#ffffff",
    labelStyle: "uppercase",
    valueFontWeight: "normal",
    valueSizeMultiplier: 1.1,
    labelSizeMultiplier: 0.42,
    labelLetterSpacing: 0.1,
    accentColor: "#fb7185"
  }
};

const thinLineTemplate = {
  id: "thin-line",
  metadata: {
    id: "thin-line",
    name: "Thin Line",
    description: "Ultra-thin baseline and lightweight inline metrics",
    previewColors: { bg: "#0f172a", accent: "#cbd5e1", text: "#e2e8f0" }
  },
  config: {
    templateId: "thin-line",
    layoutMode: "thin-line",
    position: "bottom-left",
    backgroundOpacity: 0,
    fontSizePercent: 1.55,
    showHr: true,
    showPace: true,
    showDistance: true,
    showTime: true,
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    textColor: "rgba(255,255,255,0.8)",
    backgroundColor: "transparent",
    borderWidth: 0,
    borderColor: "transparent",
    cornerRadius: 0,
    textShadow: false,
    textShadowColor: "#000000",
    textShadowBlur: 0,
    lineSpacing: 1,
    layout: "horizontal",
    iconStyle: "none",
    gradientBackground: false,
    gradientStartColor: "#000000",
    gradientEndColor: "#333333",
    labelStyle: "hidden",
    valueFontWeight: "light",
    valueSizeMultiplier: 1,
    labelSizeMultiplier: 0.3,
    labelLetterSpacing: 0.1,
    accentColor: "#cbd5e1"
  }
};

const swissGridTemplate = {
  id: "swiss-grid",
  metadata: {
    id: "swiss-grid",
    name: "Swiss Grid",
    description: "Structured typographic grid in a clean bottom panel",
    previewColors: { bg: "#000000", accent: "#d1d5db", text: "#f3f4f6" }
  },
  config: {
    templateId: "swiss-grid",
    layoutMode: "swiss-grid",
    position: "bottom-left",
    backgroundOpacity: 0.72,
    fontSizePercent: 1.95,
    showHr: true,
    showPace: true,
    showDistance: true,
    showTime: true,
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    textColor: "#FFFFFF",
    backgroundColor: "rgba(0,0,0,0.72)",
    borderWidth: 0,
    borderColor: "transparent",
    cornerRadius: 0,
    textShadow: false,
    textShadowColor: "#000000",
    textShadowBlur: 0,
    lineSpacing: 1.1,
    layout: "horizontal",
    iconStyle: "none",
    gradientBackground: false,
    gradientStartColor: "#000000",
    gradientEndColor: "#333333",
    labelStyle: "uppercase",
    valueFontWeight: "normal",
    valueSizeMultiplier: 1.2,
    labelSizeMultiplier: 0.38,
    labelLetterSpacing: 0.16,
    accentColor: "#d1d5db"
  }
};

const customTemplate = {
  id: "custom",
  metadata: {
    id: "custom",
    name: "Custom",
    description: "Fully customizable overlay settings",
    previewColors: { bg: "#1a1a1a", accent: "#888888", text: "#ffffff" }
  },
  config: {
    templateId: "custom",
    layoutMode: "box",
    position: "top-left",
    backgroundOpacity: 0.7,
    fontSizePercent: 2.5,
    showHr: true,
    showPace: true,
    showDistance: true,
    showTime: true,
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    textColor: "#FFFFFF",
    backgroundColor: "#000000",
    borderWidth: 0,
    borderColor: "#FFFFFF",
    cornerRadius: 4,
    textShadow: false,
    textShadowColor: "#000000",
    textShadowBlur: 2,
    lineSpacing: 1.5,
    layout: "vertical",
    iconStyle: "outline",
    gradientBackground: false,
    gradientStartColor: "#000000",
    gradientEndColor: "#333333",
    labelStyle: "hidden",
    valueFontWeight: "bold",
    valueSizeMultiplier: 1,
    labelSizeMultiplier: 0.5,
    labelLetterSpacing: 0.1,
    accentColor: "#646cff"
  }
};

const TEMPLATES = [
  horizonTemplate,
  marginTemplate,
  lframeTemplate,
  classicTemplate,
  floatingPillsTemplate,
  arcGaugeTemplate,
  heroNumberTemplate,
  dashboardHudTemplate,
  cinematicBarTemplate,
  splitEdgesTemplate,
  stackedSerifTemplate,
  editorialTemplate,
  tickerTapeTemplate,
  whisperTemplate,
  twoToneTemplate,
  condensedStripTemplate,
  softRoundedTemplate,
  thinLineTemplate,
  swissGridTemplate,
  customTemplate
];
const TEMPLATE_MAP = {
  "horizon": horizonTemplate,
  "margin": marginTemplate,
  "l-frame": lframeTemplate,
  "classic": classicTemplate,
  "floating-pills": floatingPillsTemplate,
  "arc-gauge": arcGaugeTemplate,
  "hero-number": heroNumberTemplate,
  "dashboard-hud": dashboardHudTemplate,
  "cinematic-bar": cinematicBarTemplate,
  "split-edges": splitEdgesTemplate,
  "stacked-serif": stackedSerifTemplate,
  "editorial": editorialTemplate,
  "ticker-tape": tickerTapeTemplate,
  "whisper": whisperTemplate,
  "two-tone": twoToneTemplate,
  "condensed-strip": condensedStripTemplate,
  "soft-rounded": softRoundedTemplate,
  "thin-line": thinLineTemplate,
  "swiss-grid": swissGridTemplate,
  "custom": customTemplate
};
function getTemplateConfig$1(templateId) {
  return { ...TEMPLATE_MAP[templateId].config };
}
function getAllTemplateMetadata$1() {
  return TEMPLATES.filter((t) => t.id !== "custom").map((t) => t.metadata);
}

function getTemplateConfig(templateId) {
  return getTemplateConfig$1(templateId);
}
function getAllTemplateMetadata() {
  return getAllTemplateMetadata$1();
}
({
  "horizon": TEMPLATE_MAP["horizon"].metadata,
  "margin": TEMPLATE_MAP["margin"].metadata,
  "l-frame": TEMPLATE_MAP["l-frame"].metadata,
  "classic": TEMPLATE_MAP["classic"].metadata,
  "floating-pills": TEMPLATE_MAP["floating-pills"].metadata,
  "arc-gauge": TEMPLATE_MAP["arc-gauge"].metadata,
  "hero-number": TEMPLATE_MAP["hero-number"].metadata,
  "dashboard-hud": TEMPLATE_MAP["dashboard-hud"].metadata,
  "cinematic-bar": TEMPLATE_MAP["cinematic-bar"].metadata,
  "split-edges": TEMPLATE_MAP["split-edges"].metadata,
  "stacked-serif": TEMPLATE_MAP["stacked-serif"].metadata,
  "editorial": TEMPLATE_MAP["editorial"].metadata,
  "ticker-tape": TEMPLATE_MAP["ticker-tape"].metadata,
  "whisper": TEMPLATE_MAP["whisper"].metadata,
  "two-tone": TEMPLATE_MAP["two-tone"].metadata,
  "condensed-strip": TEMPLATE_MAP["condensed-strip"].metadata,
  "soft-rounded": TEMPLATE_MAP["soft-rounded"].metadata,
  "thin-line": TEMPLATE_MAP["thin-line"].metadata,
  "swiss-grid": TEMPLATE_MAP["swiss-grid"].metadata,
  "custom": TEMPLATE_MAP["custom"].metadata
});
({
  "horizon": TEMPLATE_MAP["horizon"].config,
  "margin": TEMPLATE_MAP["margin"].config,
  "l-frame": TEMPLATE_MAP["l-frame"].config,
  "classic": TEMPLATE_MAP["classic"].config,
  "floating-pills": TEMPLATE_MAP["floating-pills"].config,
  "arc-gauge": TEMPLATE_MAP["arc-gauge"].config,
  "hero-number": TEMPLATE_MAP["hero-number"].config,
  "dashboard-hud": TEMPLATE_MAP["dashboard-hud"].config,
  "cinematic-bar": TEMPLATE_MAP["cinematic-bar"].config,
  "split-edges": TEMPLATE_MAP["split-edges"].config,
  "stacked-serif": TEMPLATE_MAP["stacked-serif"].config,
  "editorial": TEMPLATE_MAP["editorial"].config,
  "ticker-tape": TEMPLATE_MAP["ticker-tape"].config,
  "whisper": TEMPLATE_MAP["whisper"].config,
  "two-tone": TEMPLATE_MAP["two-tone"].config,
  "condensed-strip": TEMPLATE_MAP["condensed-strip"].config,
  "soft-rounded": TEMPLATE_MAP["soft-rounded"].config,
  "thin-line": TEMPLATE_MAP["thin-line"].config,
  "swiss-grid": TEMPLATE_MAP["swiss-grid"].config,
  "custom": TEMPLATE_MAP["custom"].config
});

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
function getResolutionTuning(width, height) {
  const shortSide = Math.min(width, height);
  const textScale = clamp(shortSide / 1080, 0.86, 1.18);
  const spacingScale = clamp(shortSide / 1080, 0.92, 1.1);
  const labelTrackingScale = shortSide < 900 ? 0.82 : 1;
  return {
    textScale,
    spacingScale,
    labelTrackingScale
  };
}
function fontWeightValue(weight) {
  switch (weight) {
    case "light":
      return 300;
    case "normal":
      return 400;
    case "bold":
      return 700;
    default:
      return 400;
  }
}
function applyTextShadow(ctx, config) {
  if (config.textShadow && config.textShadowColor) {
    ctx.shadowColor = config.textShadowColor;
    ctx.shadowBlur = config.textShadowBlur || 4;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
  }
}
function getMarginLabel(label) {
  switch (label.toLowerCase()) {
    case "heart rate":
      return "HR";
    case "distance":
      return "DIST";
    default:
      return label.toUpperCase();
  }
}
function getStableMetricValue(labelOrKey) {
  switch (labelOrKey.toLowerCase()) {
    case "pace":
      return "88:88";
    case "heart rate":
    case "heartrate":
    case "heart":
    case "hr":
      return "188";
    case "distance":
    case "dist":
      return "88.8";
    case "time":
    case "elapsed":
      return "88:88:88";
    default:
      return "888";
  }
}

function renderHorizonLayout(ctx, metrics, w, h, config) {
  const tuning = getResolutionTuning(w, h);
  const barHeight = h * 0.16;
  const barY = h - barHeight;
  drawGradientBackground(ctx, w, h, barY, barHeight, config.backgroundOpacity);
  drawProgressLine(ctx, w, h, config.accentColor);
  const fontFamily = config.fontFamily || "Inter, sans-serif";
  const baseFontSize = Math.round(h * (config.fontSizePercent || 2.4) / 100 * tuning.textScale);
  const labelSize = Math.max(8, Math.round(baseFontSize * (config.labelSizeMultiplier || 0.4)));
  const padding = w * 0.04 * tuning.spacingScale;
  const columnWidth = (w - padding * 2) / metrics.length;
  const { valueSize, unitSize } = calculateOptimalFontSizes$1(ctx, metrics, columnWidth, {
    baseFontSize,
    barHeight,
    fontFamily,
    valueWeight: config.valueFontWeight || "bold",
    valueMultiplier: config.valueSizeMultiplier || 2.5
  });
  ctx.save();
  applyTextShadow(ctx, config);
  for (let i = 0; i < metrics.length; i++) {
    renderMetricColumn(ctx, metrics[i], i, {
      padding,
      columnWidth,
      centerX: padding + columnWidth * i + columnWidth / 2,
      baselineY: h - barHeight * 0.22,
      labelSize,
      valueSize,
      unitSize,
      fontFamily,
      valueWeight: config.valueFontWeight || "bold",
      textColor: config.textColor || "#FFFFFF"
    });
  }
  ctx.restore();
}
function drawGradientBackground(ctx, w, h, barY, barHeight, opacity) {
  const grad = ctx.createLinearGradient(0, barY - barHeight * 0.5, 0, h);
  grad.addColorStop(0, "rgba(0,0,0,0)");
  grad.addColorStop(0.4, "rgba(0,0,0,0.3)");
  grad.addColorStop(1, `rgba(0,0,0,${opacity})`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, barY - barHeight * 0.5, w, barHeight * 1.5);
}
function drawProgressLine(ctx, w, h, accentColor) {
  const accent = accentColor || "#ef4444";
  ctx.fillStyle = accent;
  ctx.fillRect(0, h - Math.max(2, h * 3e-3), w * 0.35, Math.max(2, h * 3e-3));
}
function calculateOptimalFontSizes$1(ctx, metrics, columnWidth, config) {
  let valueSize = Math.min(
    Math.round(config.baseFontSize * config.valueMultiplier),
    Math.round(config.barHeight * 0.43)
  );
  const minValueSize = Math.max(12, Math.round(config.barHeight * 0.22));
  while (valueSize > minValueSize) {
    const unitSizeTry = Math.max(8, Math.round(valueSize * 0.42));
    const weightTry = fontWeightValue(config.valueWeight);
    if (metricsFitInColumns(ctx, metrics, columnWidth, valueSize, unitSizeTry, weightTry, config.fontFamily)) {
      break;
    }
    valueSize -= 1;
  }
  return { valueSize, unitSize: Math.max(8, Math.round(valueSize * 0.42)) };
}
function metricsFitInColumns(ctx, metrics, columnWidth, valueSize, unitSize, weight, fontFamily) {
  for (const metric of metrics) {
    ctx.font = `${weight} ${valueSize}px ${fontFamily}`;
    const valueWidth = ctx.measureText(getStableMetricValue(metric.label)).width;
    ctx.font = `300 ${unitSize}px ${fontFamily}`;
    const unitWidth = metric.unit ? ctx.measureText(metric.unit).width : 0;
    if (Math.max(valueWidth, unitWidth) > columnWidth * 0.82) {
      return false;
    }
  }
  return true;
}
function renderMetricColumn(ctx, metric, index, config) {
  const { padding, columnWidth, centerX, baselineY, labelSize, valueSize, unitSize, fontFamily, valueWeight, textColor } = config;
  const labelY = baselineY - valueSize - labelSize * 0.35;
  const valueY = baselineY;
  const unitY = baselineY + unitSize * 1.28;
  if (index > 0) {
    ctx.strokeStyle = "rgba(255,255,255,0.1)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding + columnWidth * index, labelY - labelSize * 0.3);
    ctx.lineTo(padding + columnWidth * index, unitY + unitSize * 0.35);
    ctx.stroke();
  }
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.font = `500 ${labelSize}px ${fontFamily}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  ctx.fillText(metric.label.toUpperCase(), centerX, labelY);
  const weight = fontWeightValue(valueWeight);
  ctx.fillStyle = textColor;
  ctx.font = `${weight} ${valueSize}px ${fontFamily}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(metric.value, centerX, valueY);
  if (metric.unit) {
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = `300 ${unitSize}px ${fontFamily}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(metric.unit, centerX, unitY);
  }
}

function renderMarginLayout(ctx, metrics, w, h, config) {
  const tuning = getResolutionTuning(w, h);
  drawEdgeGradients(ctx, w, h, config.backgroundOpacity);
  const fontFamily = config.fontFamily || "Inter, sans-serif";
  const baseFontSize = Math.round(h * (config.fontSizePercent || 2) / 100 * tuning.textScale);
  const half = Math.ceil(metrics.length / 2);
  const leftMetrics = metrics.slice(0, half);
  const rightMetrics = metrics.slice(half);
  const marginX = w * 0.045 * tuning.spacingScale;
  ctx.save();
  applyTextShadow(ctx, config);
  renderSideMetrics(ctx, leftMetrics, {
    side: "left",
    marginX,
    startY: h * 0.18,
    containerHeight: h * 0.72,
    fontFamily,
    baseFontSize,
    tuning,
    valueWeight: config.valueFontWeight || "light",
    valueMultiplier: config.valueSizeMultiplier || 3.5,
    textColor: config.textColor || "#FFFFFF"
  });
  renderSideMetrics(ctx, rightMetrics, {
    side: "right",
    marginX,
    startY: h * 0.18,
    containerHeight: h * 0.72,
    fontFamily,
    baseFontSize,
    tuning,
    valueWeight: config.valueFontWeight || "light",
    valueMultiplier: config.valueSizeMultiplier || 3.5,
    textColor: config.textColor || "#FFFFFF",
    containerWidth: w
  });
  ctx.restore();
}
function drawEdgeGradients(ctx, w, h, opacity) {
  const leftGrad = ctx.createLinearGradient(0, 0, w * 0.15, 0);
  leftGrad.addColorStop(0, `rgba(0,0,0,${opacity * 0.7})`);
  leftGrad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = leftGrad;
  ctx.fillRect(0, 0, w * 0.15, h);
  const rightGrad = ctx.createLinearGradient(w, 0, w * 0.85, 0);
  rightGrad.addColorStop(0, `rgba(0,0,0,${opacity * 0.7})`);
  rightGrad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = rightGrad;
  ctx.fillRect(w * 0.85, 0, w * 0.15, h);
}
function renderSideMetrics(ctx, metrics, config) {
  if (metrics.length === 0) return;
  const { side, marginX, startY, containerHeight, containerWidth, fontFamily, baseFontSize, tuning, valueWeight, valueMultiplier, textColor } = config;
  const slotCount = metrics.length;
  const slotHeight = containerHeight / slotCount;
  for (let i = 0; i < metrics.length; i++) {
    const metric = metrics[i];
    const metricY = startY + i * slotHeight;
    const valueSize = calculateValueSize(baseFontSize, valueMultiplier, tuning.textScale, slotHeight);
    const labelSize = Math.max(8, Math.round(valueSize * 0.2 * tuning.textScale));
    const unitSize = Math.max(8, Math.round(valueSize * 0.22 * tuning.textScale));
    if (side === "left") {
      renderLeftMetric(ctx, metric, {
        marginX,
        metricY,
        valueSize,
        labelSize,
        unitSize,
        fontFamily,
        valueWeight,
        textColor
      });
    } else {
      renderRightMetric(ctx, metric, {
        marginX: (containerWidth || 0) - marginX,
        metricY,
        valueSize,
        unitSize,
        fontFamily,
        valueWeight,
        textColor
      });
    }
  }
}
function calculateValueSize(baseFontSize, valueMultiplier, textScale, slotHeight) {
  return Math.max(14, Math.min(
    Math.round(baseFontSize * valueMultiplier * textScale),
    Math.round(slotHeight * 0.42)
  ));
}
function renderLeftMetric(ctx, metric, config) {
  const { marginX, metricY, valueSize, labelSize, unitSize, fontFamily, valueWeight, textColor } = config;
  const valueX = marginX + labelSize * 1.5;
  const weight = fontWeightValue(valueWeight);
  ctx.fillStyle = textColor;
  ctx.font = `${weight} ${valueSize}px ${fontFamily}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(metric.value, valueX, metricY + valueSize);
  ctx.fillStyle = "rgba(255,255,255,0.4)";
  ctx.font = `300 ${unitSize}px ${fontFamily}`;
  ctx.fillText(metric.unit.toUpperCase(), valueX, metricY + valueSize + unitSize * 1.5);
  ctx.save();
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.font = `300 ${labelSize}px ${fontFamily}`;
  ctx.translate(marginX + labelSize * 0.8, metricY + valueSize * 0.5);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(getMarginLabel(metric.label), 0, 0);
  ctx.restore();
}
function renderRightMetric(ctx, metric, config) {
  const { marginX, metricY, valueSize, unitSize, fontFamily, valueWeight, textColor } = config;
  const weight = fontWeightValue(valueWeight);
  ctx.fillStyle = textColor;
  ctx.font = `${weight} ${valueSize}px ${fontFamily}`;
  ctx.textAlign = "right";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(metric.value, marginX, metricY + valueSize);
  ctx.fillStyle = "rgba(255,255,255,0.4)";
  ctx.font = `300 ${unitSize}px ${fontFamily}`;
  ctx.textAlign = "right";
  ctx.fillText(metric.unit.toUpperCase(), marginX, metricY + valueSize + unitSize * 1.5);
}

function renderLFrameLayout(ctx, metrics, _frame, w, h, config) {
  const tuning = getResolutionTuning(w, h);
  drawBottomGradient(ctx, w, h);
  const fontFamily = config.fontFamily || "Inter, sans-serif";
  const baseFontSize = Math.round(h * (config.fontSizePercent || 2) / 100 * tuning.textScale);
  const valueSizeBase = Math.round(baseFontSize * (config.valueSizeMultiplier || 3));
  const margin = w * 0.04 * tuning.spacingScale;
  const bottomMargin = h * 0.05;
  ctx.save();
  applyTextShadow(ctx, config);
  const metricsAreaWidth = w * 0.84 - margin * 0.9;
  const metricGap = metricsAreaWidth / Math.max(1, metrics.length);
  const renderedBlockWidth = metricGap * metrics.length;
  const metricsStartX = Math.max(margin, (w - renderedBlockWidth) / 2);
  const metricsY = h - bottomMargin - margin * 0.3;
  const { valueSize, labelSize, unitSize } = calculateOptimalFontSizes(ctx, metrics, metricGap, {
    valueSizeBase,
    h,
    fontFamily,
    valueWeight: config.valueFontWeight || "light"
  });
  for (let i = 0; i < metrics.length; i++) {
    renderMetric(ctx, metrics[i], i, {
      metricsStartX,
      metricGap,
      metricsY,
      valueSize,
      labelSize,
      unitSize,
      fontFamily,
      valueWeight: config.valueFontWeight || "light",
      textColor: config.textColor || "#FFFFFF"
    });
  }
  drawProgressBar(ctx, w, h);
  ctx.restore();
}
function drawBottomGradient(ctx, w, h) {
  const grad = ctx.createLinearGradient(0, h * 0.7, 0, h);
  grad.addColorStop(0, "rgba(0,0,0,0)");
  grad.addColorStop(1, "rgba(0,0,0,0.25)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, h * 0.7, w, h * 0.3);
}
function calculateOptimalFontSizes(ctx, metrics, metricGap, config) {
  let valueSize = Math.max(12, Math.min(
    config.valueSizeBase,
    Math.round(config.h * 0.09),
    Math.round(metricGap * 0.4)
  ));
  const minValueSize = Math.max(10, Math.round(config.h * 0.035));
  while (valueSize > minValueSize) {
    const labelSizeTry = Math.max(8, Math.round(valueSize * 0.2));
    const unitSizeTry = Math.max(8, Math.round(valueSize * 0.28));
    const weightTry = fontWeightValue(config.valueWeight);
    if (metricsFit(ctx, metrics, metricGap, valueSize, labelSizeTry, unitSizeTry, weightTry, config)) {
      break;
    }
    valueSize -= 1;
  }
  return {
    valueSize,
    labelSize: Math.max(8, Math.round(valueSize * 0.2)),
    unitSize: Math.max(8, Math.round(valueSize * 0.28))
  };
}
function metricsFit(ctx, metrics, metricGap, valueSize, labelSize, unitSize, weight, config) {
  for (const metric of metrics) {
    ctx.font = `${weight} ${valueSize}px ${config.fontFamily}`;
    const valueWidth = ctx.measureText(getStableMetricValue(metric.label)).width;
    ctx.font = `300 ${unitSize}px ${config.fontFamily}`;
    const unitWidth = metric.unit ? ctx.measureText(metric.unit).width : 0;
    ctx.font = `300 ${labelSize}px ${config.fontFamily}`;
    const labelWidth = ctx.measureText(metric.label.toUpperCase()).width;
    if (Math.max(valueWidth, unitWidth, labelWidth) > metricGap * 0.84) {
      return false;
    }
  }
  return true;
}
function renderMetric(ctx, metric, index, config) {
  const { metricsStartX, metricGap, metricsY, valueSize, labelSize, unitSize, fontFamily, valueWeight, textColor } = config;
  const mx = metricsStartX + index * metricGap + metricGap / 2;
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.font = `300 ${labelSize}px ${fontFamily}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  ctx.fillText(metric.label.toUpperCase(), mx, metricsY - valueSize - labelSize * 0.2);
  const weight = fontWeightValue(valueWeight);
  ctx.fillStyle = textColor;
  ctx.font = `${weight} ${valueSize}px ${fontFamily}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(metric.value, mx, metricsY);
  if (metric.unit) {
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = `300 ${unitSize}px ${fontFamily}`;
    ctx.textAlign = "center";
    ctx.fillText(metric.unit, mx, metricsY + unitSize * 1.25);
  }
}
function drawProgressBar(ctx, w, h) {
  const barH = Math.max(1, h * 2e-3);
  ctx.fillStyle = "rgba(128,128,128,0.3)";
  ctx.fillRect(0, h - barH * 2, w, barH * 2);
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.fillRect(0, h - barH * 2, w * 0.33, barH * 2);
}

function renderClassicLayout(ctx, metrics, w, h, config) {
  const tuning = getResolutionTuning(w, h);
  const fontSize = Math.round(h * (config.fontSizePercent / 100) * tuning.textScale);
  const lineHeight = fontSize * (config.lineSpacing || 1.5);
  const padding = fontSize * 0.6 * tuning.spacingScale;
  const borderRadius = config.cornerRadius !== void 0 ? Math.round(h * (config.cornerRadius / 100)) : Math.round(h * 5e-3);
  const lines = buildOverlayLines(metrics);
  if (lines.length === 0) return;
  const stableLines = buildStableOverlayLines(metrics);
  const fontFamily = config.fontFamily || '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.font = `bold ${fontSize}px ${fontFamily}`;
  const maxWidth = calculateMaxLineWidth(ctx, stableLines);
  const bgWidth = maxWidth + padding * 2;
  const bgHeight = lines.length * lineHeight + padding * 2;
  const { x, y } = calculatePosition(config.position || "bottom-left", w, h, bgWidth, bgHeight, fontSize);
  ctx.save();
  drawBackground(ctx, x, y, bgWidth, bgHeight, borderRadius, config);
  drawBorder(ctx, x, y, bgWidth, bgHeight, borderRadius, config);
  ctx.fillStyle = config.textColor || "#FFFFFF";
  applyTextShadow(ctx, config);
  ctx.font = `bold ${fontSize}px ${fontFamily}`;
  ctx.textBaseline = "top";
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], x + padding, y + padding + i * lineHeight);
  }
  ctx.restore();
}
function calculateMaxLineWidth(ctx, lines) {
  let maxWidth = 0;
  for (const line of lines) {
    const m = ctx.measureText(line);
    if (m.width > maxWidth) maxWidth = m.width;
  }
  return maxWidth;
}
function calculatePosition(position, w, h, bgWidth, bgHeight, margin) {
  switch (position) {
    case "top-left":
      return { x: margin, y: margin };
    case "top-right":
      return { x: w - bgWidth - margin, y: margin };
    case "bottom-left":
      return { x: margin, y: h - bgHeight - margin };
    case "bottom-right":
    default:
      return { x: w - bgWidth - margin, y: h - bgHeight - margin };
  }
}
function drawBackground(ctx, x, y, width, height, borderRadius, config) {
  if (!hasVisibleBackground(config)) return;
  if (config.gradientBackground && config.gradientStartColor && config.gradientEndColor) {
    const gradient = ctx.createLinearGradient(x, y, x, y + height);
    gradient.addColorStop(0, config.gradientStartColor);
    gradient.addColorStop(1, config.gradientEndColor);
    ctx.fillStyle = gradient;
  } else {
    ctx.fillStyle = config.backgroundColor || `rgba(0, 0, 0, ${config.backgroundOpacity})`;
  }
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, borderRadius);
  ctx.fill();
}
function drawBorder(ctx, x, y, width, height, borderRadius, config) {
  if (!config.borderWidth || !config.borderColor) return;
  ctx.strokeStyle = config.borderColor;
  ctx.lineWidth = config.borderWidth;
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, borderRadius);
  ctx.stroke();
}
function hasVisibleBackground(config) {
  const hasGradient = config.gradientBackground && !!config.gradientStartColor && !!config.gradientEndColor;
  const hasBackgroundColor = !!config.backgroundColor && config.backgroundColor !== "transparent" && config.backgroundColor !== "rgba(0, 0, 0, 0)";
  const hasOpacity = (config.backgroundOpacity || 0) > 0;
  return hasGradient || hasBackgroundColor || hasOpacity;
}
function buildOverlayLines(metrics) {
  return metrics.map((m) => {
    const icon = metricIcon(m.label);
    return `${icon} ${m.value} ${m.unit}`.trim();
  });
}
function buildStableOverlayLines(metrics) {
  return metrics.map((m) => {
    const icon = metricIcon(m.label);
    const stableValue = getStableMetricValue(m.label);
    return `${icon} ${stableValue} ${m.unit}`.trim();
  });
}
function metricIcon(label) {
  switch (label.toLowerCase()) {
    case "heart rate":
      return "❤️";
    case "pace":
      return "🏃";
    case "distance":
      return "📏";
    case "time":
      return "⏱️";
    default:
      return "";
  }
}

function renderExtendedLayout(ctx, metrics, w, h, config, layoutMode) {
  const data = toMetricMap(metrics);
  const orientation = getOrientation(w, h);
  const tuning = getResolutionTuning(w, h);
  ctx.save();
  applyTextShadow(ctx, config);
  switch (layoutMode) {
    case "floating-pills":
      drawFloatingPills(ctx, data, w, h, config, orientation, tuning);
      break;
    case "arc-gauge":
      drawArcGauge(ctx, data, w, h, config, orientation, tuning);
      break;
    case "hero-number":
      drawHeroNumber(ctx, data, w, h, config, orientation, tuning);
      break;
    case "dashboard-hud":
      drawDashboardHud(ctx, data, w, h, config, orientation, tuning);
      break;
    case "cinematic-bar":
      drawCinematicBar(ctx, data, w, h, config, orientation, tuning);
      break;
    case "split-edges":
      drawSplitEdges(ctx, data, w, h, config, orientation, tuning);
      break;
    case "stacked-serif":
      drawStackedSerif(ctx, data, w, h, config, orientation, tuning);
      break;
    case "editorial":
      drawEditorial(ctx, data, w, h, config, orientation, tuning);
      break;
    case "ticker-tape":
      drawTickerTape(ctx, data, w, h, config, orientation, tuning);
      break;
    case "whisper":
      drawWhisper(ctx, data, w, h, config, orientation, tuning);
      break;
    case "two-tone":
      drawTwoTone(ctx, data, w, h, config, orientation, tuning);
      break;
    case "condensed-strip":
      drawCondensedStrip(ctx, data, w, h, config, orientation, tuning);
      break;
    case "soft-rounded":
      drawSoftRounded(ctx, data, w, h, config, orientation, tuning);
      break;
    case "thin-line":
      drawThinLine(ctx, data, w, h, config, orientation, tuning);
      break;
    case "swiss-grid":
      drawSwissGrid(ctx, data, w, h, config, orientation, tuning);
      break;
  }
  ctx.restore();
}
function drawFloatingPills(ctx, data, w, h, config, orientation, tuning) {
  const items = [
    data.pace ? { label: "PACE", value: data.pace, unit: "min/km" } : null,
    data.heartRate ? { label: "HR", value: data.heartRate, unit: "bpm" } : null,
    data.distance ? { label: "DIST", value: data.distance, unit: "km" } : null,
    data.time ? { label: "TIME", value: data.time, unit: "min" } : null
  ].filter(Boolean);
  if (items.length === 0) return;
  const gap = orientation.shortSide * (orientation.isPortrait ? 0.012 : 9e-3);
  const pillH = orientation.shortSide * (orientation.isPortrait ? 0.085 : 0.07);
  const totalW = w - orientation.safePad * 2;
  const pillW = (totalW - gap * (items.length - 1)) / items.length;
  const y = h - orientation.safePad - pillH;
  const labelSize = Math.max(8, Math.round(pillH * 0.18 * tuning.textScale));
  const valueSize = Math.max(12, Math.round(pillH * 0.3 * tuning.textScale));
  const unitSize = Math.max(8, Math.round(pillH * 0.16 * tuning.textScale));
  const radius = pillH / 2;
  for (let i = 0; i < items.length; i++) {
    const x = orientation.safePad + i * (pillW + gap);
    ctx.fillStyle = "rgba(255,255,255,0.14)";
    ctx.beginPath();
    ctx.roundRect(x, y, pillW, pillH, radius);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.22)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.62)";
    ctx.font = `600 ${labelSize}px ${config.fontFamily}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(items[i].label, x + pillW * 0.5, y + pillH * 0.14);
    ctx.fillStyle = config.textColor || "#FFFFFF";
    ctx.font = `${fontWeightValue(config.valueFontWeight || "normal")} ${valueSize}px ${config.fontFamily}`;
    ctx.textBaseline = "alphabetic";
    ctx.fillText(items[i].value, x + pillW * 0.5, y + pillH * 0.66);
    ctx.fillStyle = "rgba(255,255,255,0.58)";
    ctx.font = `500 ${unitSize}px ${config.fontFamily}`;
    ctx.fillText(items[i].unit, x + pillW * 0.5, y + pillH * 0.9);
  }
}
function drawArcGauge(ctx, data, w, h, config, orientation, tuning) {
  const paceNumber = parsePace(data.pace);
  const progress = Math.max(0, Math.min(1, (10 - paceNumber) / 7));
  const radius = orientation.shortSide * (orientation.isPortrait ? 0.18 : 0.13);
  const cx = w * 0.5;
  const cy = orientation.safePad + radius + orientation.compactPad;
  const start = Math.PI;
  const end = start + Math.PI * progress;
  const stroke = Math.max(2, radius * 0.08);
  if (data.pace) {
    ctx.strokeStyle = "rgba(255,255,255,0.2)";
    ctx.lineWidth = stroke;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(cx, cy, radius, Math.PI, 0, false);
    ctx.stroke();
    ctx.strokeStyle = config.accentColor || "#FFFFFF";
    ctx.beginPath();
    ctx.arc(cx, cy, radius, start, end, false);
    ctx.stroke();
    const dotX = cx + Math.cos(end) * radius;
    const dotY = cy + Math.sin(end) * radius;
    ctx.fillStyle = config.accentColor || "#FFFFFF";
    ctx.beginPath();
    ctx.arc(dotX, dotY, Math.max(3, stroke * 1.2), 0, Math.PI * 2);
    ctx.fill();
    const paceSize = Math.max(20, Math.round(radius * 0.58 * tuning.textScale));
    const labelSize = Math.max(8, Math.round(radius * 0.14 * tuning.textScale));
    ctx.fillStyle = config.textColor || "#FFFFFF";
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.font = `300 ${paceSize}px ${config.fontFamily}`;
    ctx.fillText(data.pace, cx, cy + radius * 0.35);
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.font = `500 ${labelSize}px ${config.fontFamily}`;
    ctx.fillText("MIN / KM", cx, cy + radius * 0.58);
  }
  const sideValueSize = Math.max(14, Math.round(radius * 0.32));
  const sideLabelSize = Math.max(8, Math.round(radius * 0.12));
  const leftX = orientation.safePad;
  const topY = orientation.isPortrait ? h * 0.42 : h * 0.34;
  const leftItems = [
    data.heartRate ? { label: "HR", value: data.heartRate, unit: "bpm" } : null,
    data.distance ? { label: "DIST", value: data.distance, unit: "km" } : null
  ].filter(Boolean);
  leftItems.forEach((item, idx) => {
    drawMetricBlock(
      ctx,
      leftX,
      topY + idx * sideValueSize * 2.5,
      item.label,
      item.value,
      item.unit,
      sideLabelSize,
      sideValueSize,
      config,
      "left"
    );
  });
  if (data.time) {
    drawMetricBlock(ctx, w - orientation.safePad, h - orientation.safePad - sideValueSize * 1.4, "ELAPSED", data.time, "", sideLabelSize, sideValueSize, config, "right");
  }
}
function drawHeroNumber(ctx, data, w, h, config, orientation, tuning) {
  const heroSize = Math.round(orientation.shortSide * (orientation.isPortrait ? 0.23 : 0.18) * tuning.textScale);
  const unitSize = Math.max(12, Math.round(heroSize * 0.2));
  if (data.pace) {
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = config.textColor || "#FFFFFF";
    ctx.font = `900 ${heroSize}px ${config.fontFamily}`;
    ctx.fillText(data.pace, w * 0.5, h * (orientation.isPortrait ? 0.35 : 0.31));
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.font = `600 ${unitSize}px ${config.fontFamily}`;
    ctx.fillText("MIN/KM", w * 0.5, h * (orientation.isPortrait ? 0.4 : 0.36));
  }
  const rowY = h - orientation.safePad;
  const cols = [
    data.heartRate ? `♥ ${data.heartRate} bpm` : null,
    data.distance ? `↗ ${data.distance} km` : null,
    data.time ? `◷ ${data.time}` : null
  ].filter(Boolean);
  if (cols.length === 0) return;
  const step = w / (cols.length + 1);
  ctx.font = `400 ${Math.max(11, Math.round(unitSize * 0.95))}px ${config.fontFamily}`;
  for (let i = 0; i < cols.length; i++) {
    ctx.fillStyle = "rgba(255,255,255,0.82)";
    ctx.fillText(cols[i], step * (i + 1), rowY);
  }
}
function drawDashboardHud(ctx, data, w, h, config, orientation, tuning) {
  const valueSize = Math.max(18, Math.round(orientation.shortSide * 0.06 * tuning.textScale));
  const labelSize = Math.max(8, Math.round(valueSize * 0.28));
  if (data.pace) {
    drawMetricBlock(ctx, orientation.safePad, orientation.safePad, "PACE", data.pace, "min/km", labelSize, valueSize, config, "left");
  }
  if (data.heartRate) {
    drawMetricBlock(ctx, w - orientation.safePad, orientation.safePad, "HEART RATE", data.heartRate, "bpm", labelSize, valueSize, { ...config}, "right");
  }
  const y = h - orientation.safePad;
  if (data.distance) {
    drawMetricInline(ctx, orientation.safePad, y, "DISTANCE", `${data.distance} km`, labelSize, valueSize * 0.7, config, "left");
  }
  if (data.time) {
    drawMetricInline(ctx, w - orientation.safePad, y, "ELAPSED", data.time, labelSize, valueSize * 0.7, config, "right");
  }
  ctx.strokeStyle = "rgba(255,255,255,0.15)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(w * 0.35, h - orientation.safePad - valueSize * 0.35);
  ctx.lineTo(w * 0.65, h - orientation.safePad - valueSize * 0.35);
  ctx.stroke();
}
function drawCinematicBar(ctx, data, w, h, config, orientation, tuning) {
  const topBar = Math.round(h * (orientation.isPortrait ? 0.075 : 0.06));
  const bottomBar = Math.round(h * (orientation.isPortrait ? 0.1 : 0.085));
  ctx.fillStyle = "rgba(0,0,0,0.62)";
  ctx.fillRect(0, 0, w, topBar);
  ctx.fillRect(0, h - bottomBar, w, bottomBar);
  const items = [
    data.pace ? ["PACE", `${data.pace} min/km`] : null,
    data.heartRate ? ["HR", `${data.heartRate} bpm`] : null,
    data.distance ? ["DIST", `${data.distance} km`] : null,
    data.time ? ["TIME", data.time] : null
  ].filter(Boolean);
  if (items.length === 0) return;
  const labelSize = Math.max(8, Math.round(orientation.shortSide * 0.014 * tuning.textScale));
  const valueSize = Math.max(12, Math.round(orientation.shortSide * 0.024 * tuning.textScale));
  const segmentW = (w - orientation.safePad * 2) / items.length;
  for (let i = 0; i < items.length; i++) {
    const x = orientation.safePad + segmentW * i + segmentW * 0.5;
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.font = `500 ${labelSize}px ${config.fontFamily}`;
    ctx.fillText(items[i][0], x, h - bottomBar * 0.62);
    ctx.fillStyle = config.textColor || "#FFFFFF";
    ctx.font = `400 ${valueSize}px ${config.fontFamily}`;
    ctx.fillText(items[i][1], x, h - bottomBar * 0.28);
    if (i > 0) {
      ctx.strokeStyle = "rgba(255,255,255,0.16)";
      ctx.beginPath();
      ctx.moveTo(orientation.safePad + segmentW * i, h - bottomBar * 0.72);
      ctx.lineTo(orientation.safePad + segmentW * i, h - bottomBar * 0.18);
      ctx.stroke();
    }
  }
  ctx.textAlign = "left";
  ctx.fillStyle = "rgba(255,255,255,0.3)";
  ctx.font = `500 ${Math.max(8, Math.round(labelSize * 0.95))}px ${config.fontFamily}`;
  ctx.fillText("REC ●", orientation.safePad, topBar * 0.63);
  ctx.textAlign = "right";
  ctx.fillText("GPX TELEMETRY", w - orientation.safePad, topBar * 0.63);
}
function drawSplitEdges(ctx, data, w, h, config, orientation, tuning) {
  const cardW = w * (orientation.isPortrait ? 0.36 : 0.24);
  const cardH = h * (orientation.isPortrait ? 0.13 : 0.18);
  const labelSize = Math.max(8, Math.round(orientation.shortSide * 0.012 * tuning.textScale));
  const valueSize = Math.max(14, Math.round(orientation.shortSide * 0.04 * tuning.textScale));
  const p = orientation.safePad;
  const cards = [
    data.pace ? { label: "PACE", value: data.pace, unit: "min/km", align: "left" } : null,
    data.heartRate ? { label: "HEART RATE", value: data.heartRate, unit: "bpm", align: "right" } : null,
    data.distance ? { label: "DISTANCE", value: data.distance, unit: "km", align: "left" } : null,
    data.time ? { label: "ELAPSED", value: data.time, unit: "min", align: "right" } : null
  ].filter(Boolean);
  const slots = [
    { x: p, y: p },
    { x: w - p - cardW, y: p },
    { x: p, y: h - p - cardH },
    { x: w - p - cardW, y: h - p - cardH }
  ];
  cards.forEach((card, idx) => {
    const slot = slots[idx];
    drawCornerCard(ctx, slot.x, slot.y, cardW, cardH, card.label, card.value, card.unit, labelSize, valueSize, config, card.align);
  });
  if (cards.length > 1) {
    const cx = w * 0.5;
    const cy = h * 0.5;
    ctx.strokeStyle = "rgba(255,255,255,0.14)";
    ctx.beginPath();
    ctx.moveTo(cx - 16, cy);
    ctx.lineTo(cx + 16, cy);
    ctx.moveTo(cx, cy - 16);
    ctx.lineTo(cx, cy + 16);
    ctx.stroke();
  }
}
function drawStackedSerif(ctx, data, _w, h, config, orientation, tuning) {
  const items = [
    data.pace ? ["pace", data.pace, "min/km"] : null,
    data.heartRate ? ["heart", data.heartRate, "bpm"] : null,
    data.distance ? ["dist", data.distance, "km"] : null,
    data.time ? ["time", data.time, ""] : null
  ].filter(Boolean);
  if (items.length === 0) return;
  const valueSize = Math.max(16, Math.round(orientation.shortSide * 0.045 * tuning.textScale));
  const labelSize = Math.max(9, Math.round(valueSize * 0.28));
  const unitSize = Math.max(8, Math.round(labelSize * 0.95));
  const x = orientation.safePad;
  const rowH = valueSize * 1.35;
  const startY = h - orientation.safePad - rowH * (items.length - 0.2);
  ctx.font = `400 ${valueSize}px ${config.fontFamily}`;
  const maxValueWidth = Math.max(...items.map((item) => ctx.measureText(getStableMetricValue(stackedSerifKeyToLabel(item[0]))).width));
  const labelX = x;
  const valueX = x + labelSize * 6;
  const unitX = valueX + maxValueWidth + Math.max(10, labelSize * 0.9);
  for (let i = 0; i < items.length; i++) {
    const y = startY + i * rowH;
    ctx.textAlign = "left";
    ctx.fillStyle = "rgba(255,255,255,0.28)";
    ctx.font = `500 ${labelSize}px Inter, sans-serif`;
    ctx.fillText(items[i][0], labelX, y);
    ctx.fillStyle = config.textColor || "#FFFFFF";
    ctx.font = `400 ${valueSize}px ${config.fontFamily}`;
    ctx.fillText(items[i][1], valueX, y);
    if (items[i][2]) {
      ctx.fillStyle = "rgba(255,255,255,0.28)";
      ctx.font = `400 ${unitSize}px Inter, sans-serif`;
      ctx.fillText(items[i][2], unitX, y);
    }
  }
}
function drawEditorial(ctx, data, w, h, config, orientation, tuning) {
  const heroSize = Math.max(34, Math.round(orientation.shortSide * 0.15 * tuning.textScale));
  const labelSize = Math.max(8, Math.round(heroSize * 0.14));
  const smallValue = Math.max(13, Math.round(heroSize * 0.32));
  const leftX = orientation.safePad;
  const baselineY = h - orientation.safePad - heroSize * 0.15;
  if (data.pace) {
    ctx.textAlign = "left";
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.font = `500 ${labelSize}px Inter, sans-serif`;
    ctx.fillText("CURRENT PACE", leftX, baselineY - heroSize * 1.18);
    ctx.fillStyle = config.textColor || "#FFFFFF";
    ctx.font = `400 ${heroSize}px ${config.fontFamily}`;
    ctx.fillText(data.pace, leftX, baselineY);
    ctx.fillStyle = "rgba(255,255,255,0.32)";
    ctx.font = `400 ${Math.max(10, Math.round(labelSize * 1.05))}px Inter, sans-serif`;
    ctx.fillText("min/km", leftX, baselineY + Math.max(12, Math.round(heroSize * 0.24)));
  }
  const rightX = w - orientation.safePad;
  const topY = orientation.safePad + smallValue;
  const lines = [
    data.heartRate ? ["HEART RATE", `${data.heartRate} bpm`] : null,
    data.distance ? ["DISTANCE", `${data.distance} km`] : null,
    data.time ? ["ELAPSED", data.time] : null
  ].filter(Boolean);
  for (let i = 0; i < lines.length; i++) {
    const y = topY + i * smallValue * 2.15;
    ctx.textAlign = "right";
    ctx.fillStyle = "rgba(255,255,255,0.22)";
    ctx.font = `500 ${Math.max(8, Math.round(labelSize * 0.85))}px Inter, sans-serif`;
    ctx.fillText(lines[i][0], rightX, y - smallValue * 0.8);
    ctx.fillStyle = "rgba(255,255,255,0.78)";
    ctx.font = `400 ${smallValue}px ${config.fontFamily}`;
    ctx.fillText(lines[i][1], rightX, y);
  }
}
function drawTickerTape(ctx, data, w, h, config, orientation, tuning) {
  const barH = Math.max(24, Math.round(h * (orientation.isPortrait ? 0.052 : 0.046)));
  const y = h - barH;
  ctx.fillStyle = "rgba(0,0,0,0.95)";
  ctx.fillRect(0, y, w, barH);
  const baseTextSize = Math.max(9, Math.round(barH * 0.36 * tuning.textScale));
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillStyle = config.accentColor || "#ef4444";
  let textSize = baseTextSize;
  ctx.font = `700 ${Math.max(8, Math.round(textSize * 0.92))}px ${config.fontFamily}`;
  ctx.fillText("LIVE", orientation.safePad, y + barH / 2);
  const parts = [
    data.pace ? `PACE ${data.pace} min/km` : null,
    data.heartRate ? `HR ${data.heartRate} bpm` : null,
    data.distance ? `DIST ${data.distance} km` : null,
    data.time ? `TIME ${data.time}` : null
  ].filter(Boolean);
  if (parts.length === 0) return;
  const content = parts.join("  |  ");
  const worstCaseContent = [
    data.pace ? `PACE ${getStableMetricValue("pace")} min/km` : null,
    data.heartRate ? `HR ${getStableMetricValue("heart rate")} bpm` : null,
    data.distance ? `DIST ${getStableMetricValue("distance")} km` : null,
    data.time ? `TIME ${getStableMetricValue("time")}` : null
  ].filter(Boolean).join("  |  ");
  const contentX = orientation.safePad + textSize * 4.4;
  const maxContentWidth = w - contentX - orientation.safePad;
  while (textSize > 7) {
    ctx.font = `500 ${textSize}px ${config.fontFamily}`;
    if (ctx.measureText(worstCaseContent).width <= maxContentWidth) break;
    textSize -= 1;
  }
  ctx.fillStyle = "rgba(255,255,255,0.84)";
  ctx.font = `500 ${textSize}px ${config.fontFamily}`;
  ctx.fillText(content, contentX, y + barH / 2);
}
function drawWhisper(ctx, data, w, h, config, orientation, tuning) {
  const rows = [
    data.pace ? { label: "PACE", value: `${data.pace} min/km` } : null,
    data.heartRate ? { label: "HEART RATE", value: `${data.heartRate} bpm` } : null,
    data.distance ? { label: "DISTANCE", value: `${data.distance} km` } : null,
    data.time ? { label: "TIME", value: data.time } : null
  ].filter(Boolean);
  if (rows.length === 0) return;
  const textSize = Math.max(9, Math.round(orientation.shortSide * 0.019 * tuning.textScale));
  const labelSize = Math.max(8, Math.round(textSize * 0.82));
  const lineH = textSize * 3;
  const x = w - orientation.safePad;
  const y = h - orientation.safePad - lineH * rows.length;
  ctx.textAlign = "right";
  ctx.textBaseline = "top";
  rows.forEach((row, idx) => {
    const yy = y + idx * lineH;
    ctx.fillStyle = "rgba(255,255,255,0.22)";
    ctx.font = `500 ${labelSize}px ${config.fontFamily}`;
    ctx.fillText(row.label, x, yy);
    ctx.fillStyle = config.textColor || "rgba(255,255,255,0.28)";
    ctx.font = `300 ${textSize}px ${config.fontFamily}`;
    ctx.fillText(row.value, x, yy + labelSize + Math.max(2, textSize * 0.25));
  });
}
function drawTwoTone(ctx, data, w, h, config, orientation, tuning) {
  const heroSize = Math.max(34, Math.round(orientation.shortSide * (orientation.isPortrait ? 0.2 : 0.15) * tuning.textScale));
  const leftX = orientation.safePad;
  const bottomY = h - orientation.safePad;
  if (data.pace) {
    ctx.textAlign = "left";
    ctx.fillStyle = config.accentColor || "#c8ff00";
    ctx.font = `800 ${heroSize}px ${config.fontFamily}`;
    ctx.fillText(data.pace, leftX, bottomY - heroSize * 0.35);
    ctx.fillStyle = "rgba(255,255,255,0.42)";
    ctx.font = `500 ${Math.max(10, Math.round(heroSize * 0.16))}px ${config.fontFamily}`;
    ctx.fillText("MIN/KM", leftX, bottomY);
  }
  const rightX = w - orientation.safePad;
  const valSize = Math.max(14, Math.round(heroSize * 0.35));
  const lblSize = Math.max(8, Math.round(valSize * 0.35));
  const rows = [
    data.heartRate ? ["HEART RATE", `${data.heartRate} bpm`] : null,
    data.distance ? ["DISTANCE", `${data.distance} km`] : null,
    data.time ? ["TIME", data.time] : null
  ].filter(Boolean);
  if (rows.length === 0) return;
  const rowH = valSize * 1.35 + lblSize * 1.15;
  const startY = bottomY - rowH * rows.length;
  ctx.textBaseline = "top";
  for (let i = 0; i < rows.length; i++) {
    const y = startY + i * rowH;
    ctx.textAlign = "right";
    ctx.fillStyle = "rgba(255,255,255,0.32)";
    ctx.font = `500 ${lblSize}px ${config.fontFamily}`;
    ctx.fillText(rows[i][0], rightX, y);
    ctx.fillStyle = config.textColor || "#FFFFFF";
    ctx.font = `300 ${valSize}px ${config.fontFamily}`;
    ctx.fillText(rows[i][1], rightX, y + lblSize + Math.max(2, valSize * 0.16));
  }
}
function drawCondensedStrip(ctx, data, w, h, config, orientation, tuning) {
  const barH = Math.max(24, Math.round(h * (orientation.isPortrait ? 0.06 : 0.05)));
  const y = h - barH;
  ctx.fillStyle = config.backgroundColor || "#FFFFFF";
  ctx.fillRect(0, y, w, barH);
  const items = [
    data.pace ? ["PACE", `${data.pace} min/km`] : null,
    data.heartRate ? ["HR", `${data.heartRate} bpm`] : null,
    data.distance ? ["DIST", `${data.distance} km`] : null,
    data.time ? ["TIME", data.time] : null
  ].filter(Boolean);
  if (items.length === 0) return;
  const segW = w / items.length;
  const labelSize = Math.max(8, Math.round(barH * (orientation.isPortrait ? 0.22 : 0.24) * tuning.textScale));
  const baseValueSize = Math.max(9, Math.round(barH * (orientation.isPortrait ? 0.44 : 0.54) * tuning.textScale));
  let valueSize = baseValueSize;
  while (valueSize > 8) {
    let allFit = true;
    ctx.font = `700 ${valueSize}px ${config.fontFamily}`;
    for (const item of items) {
      const stableValue = condensedStripStableValue(item[0]);
      if (ctx.measureText(stableValue).width > segW * 0.9) {
        allFit = false;
        break;
      }
    }
    if (allFit) break;
    valueSize -= 1;
  }
  for (let i = 0; i < items.length; i++) {
    const x = segW * i + segW * 0.5;
    if (i > 0) {
      ctx.strokeStyle = "rgba(0,0,0,0.1)";
      ctx.beginPath();
      ctx.moveTo(segW * i, y + 2);
      ctx.lineTo(segW * i, y + barH - 2);
      ctx.stroke();
    }
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.font = `600 ${labelSize}px ${config.fontFamily}`;
    ctx.fillText(items[i][0], x, y + barH * 0.32);
    ctx.fillStyle = "#111111";
    ctx.font = `700 ${valueSize}px ${config.fontFamily}`;
    ctx.fillText(items[i][1], x, y + barH * 0.82);
  }
}
function stackedSerifKeyToLabel(key) {
  switch (key) {
    case "pace":
      return "pace";
    case "heart":
      return "heart rate";
    case "dist":
      return "distance";
    case "time":
      return "time";
    default:
      return key;
  }
}
function condensedStripStableValue(label) {
  switch (label.toUpperCase()) {
    case "PACE":
      return `${getStableMetricValue("pace")} min/km`;
    case "HR":
      return `${getStableMetricValue("heart rate")} bpm`;
    case "DIST":
      return `${getStableMetricValue("distance")} km`;
    case "TIME":
      return getStableMetricValue("time");
    default:
      return `${getStableMetricValue(label)} ${label}`;
  }
}
function drawSoftRounded(ctx, data, w, h, config, orientation, tuning) {
  const items = [
    data.pace ? ["Pace", data.pace, "min/km"] : null,
    data.heartRate ? ["HR", data.heartRate, "bpm"] : null,
    data.distance ? ["Dist", data.distance, "km"] : null,
    data.time ? ["Time", data.time, ""] : null
  ].filter(Boolean);
  if (items.length === 0) return;
  const gap = orientation.shortSide * 0.01;
  const cardH = h * (orientation.isPortrait ? 0.09 : 0.12);
  const totalW = w - orientation.safePad * 2;
  const cardW = (totalW - gap * (items.length - 1)) / items.length;
  const y = h - orientation.safePad - cardH;
  const radius = Math.max(8, cardH * 0.24);
  const labelSize = Math.max(8, Math.round(cardH * 0.16 * tuning.textScale));
  const valueSize = Math.max(12, Math.round(cardH * 0.33 * tuning.textScale));
  for (let i = 0; i < items.length; i++) {
    const x = orientation.safePad + i * (cardW + gap);
    ctx.fillStyle = i === 1 ? "rgba(255,236,240,0.92)" : "rgba(255,255,255,0.92)";
    ctx.beginPath();
    ctx.roundRect(x, y, cardW, cardH, radius);
    ctx.fill();
    const textColor = i === 1 ? "rgba(120,24,54,0.92)" : "rgba(24,24,27,0.92)";
    ctx.textAlign = "center";
    ctx.fillStyle = i === 1 ? "rgba(120,24,54,0.52)" : "rgba(24,24,27,0.45)";
    ctx.font = `600 ${labelSize}px ${config.fontFamily}`;
    ctx.fillText(items[i][0], x + cardW / 2, y + cardH * 0.28);
    ctx.fillStyle = textColor;
    ctx.font = `600 ${valueSize}px ${config.fontFamily}`;
    ctx.fillText(items[i][1], x + cardW / 2, y + cardH * 0.64);
    if (items[i][2]) {
      ctx.fillStyle = i === 1 ? "rgba(120,24,54,0.4)" : "rgba(24,24,27,0.35)";
      ctx.font = `500 ${Math.max(8, Math.round(labelSize * 0.95))}px ${config.fontFamily}`;
      ctx.fillText(items[i][2], x + cardW / 2, y + cardH * 0.86);
    }
  }
}
function drawThinLine(ctx, data, w, h, config, orientation, tuning) {
  const lineY = h - orientation.safePad - orientation.shortSide * 0.022;
  ctx.strokeStyle = "rgba(255,255,255,0.25)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(orientation.safePad, lineY);
  ctx.lineTo(w - orientation.safePad, lineY);
  ctx.stroke();
  const parts = [
    data.pace ? `${data.pace} min/km` : null,
    data.heartRate ? `${data.heartRate} bpm` : null,
    data.distance ? `${data.distance} km` : null,
    data.time ? data.time : null
  ].filter(Boolean);
  if (parts.length === 0) return;
  const text = parts.join("   ~   ");
  ctx.textAlign = "center";
  ctx.fillStyle = config.textColor || "rgba(255,255,255,0.8)";
  ctx.font = `300 ${Math.max(10, Math.round(orientation.shortSide * 0.02 * tuning.textScale))}px ${config.fontFamily}`;
  ctx.fillText(text, w * 0.5, lineY + orientation.shortSide * 0.03);
}
function drawSwissGrid(ctx, data, w, h, config, orientation, tuning) {
  const barH = Math.round(h * (orientation.isPortrait ? 0.17 : 0.2));
  const y = h - barH;
  ctx.fillStyle = "rgba(0,0,0,0.72)";
  ctx.fillRect(0, y, w, barH);
  const items = [
    data.pace ? ["Pace", data.pace, "min/km"] : null,
    data.heartRate ? ["Heart Rate", data.heartRate, "bpm"] : null,
    data.distance ? ["Distance", data.distance, "km"] : null,
    data.time ? ["Time", data.time, ""] : null
  ].filter(Boolean);
  if (items.length === 0) return;
  const sidePad = orientation.safePad;
  const contentX = sidePad;
  const contentW = w - sidePad * 2;
  const colW = contentW / items.length;
  const labelSize = Math.max(8, Math.round(barH * 0.12 * tuning.textScale));
  const valueSize = Math.max(12, Math.round(barH * 0.26 * tuning.textScale));
  const unitSize = Math.max(8, Math.round(labelSize * 0.9));
  for (let i = 0; i < items.length; i++) {
    const colX = contentX + colW * i;
    if (i > 0) {
      ctx.strokeStyle = "rgba(255,255,255,0.1)";
      ctx.beginPath();
      ctx.moveTo(colX, y + barH * 0.12);
      ctx.lineTo(colX, y + barH * 0.88);
      ctx.stroke();
    }
    const centerX = colX + colW / 2;
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(255,255,255,0.42)";
    ctx.font = `500 ${labelSize}px ${config.fontFamily}`;
    ctx.fillText(items[i][0], centerX, y + barH * 0.27);
    ctx.fillStyle = config.textColor || "#FFFFFF";
    ctx.font = `300 ${valueSize}px ${config.fontFamily}`;
    ctx.fillText(items[i][1], centerX, y + barH * 0.58);
    if (items[i][2]) {
      ctx.fillStyle = "rgba(255,255,255,0.32)";
      ctx.font = `400 ${unitSize}px ${config.fontFamily}`;
      ctx.fillText(items[i][2], centerX, y + barH * 0.76);
    }
  }
}
function drawMetricBlock(ctx, x, y, label, value, unit, labelSize, valueSize, config, align) {
  ctx.textAlign = align;
  ctx.fillStyle = `rgba(255,255,255,${label === "HEART RATE" ? 0.62 : 0.5})`;
  ctx.font = `500 ${labelSize}px ${config.fontFamily}`;
  ctx.fillText(label, x, y);
  ctx.fillStyle = config.textColor || "#FFFFFF";
  ctx.font = `${fontWeightValue(config.valueFontWeight || "light")} ${valueSize}px ${config.fontFamily}`;
  ctx.fillText(value, x, y + valueSize * 0.95);
  if (unit) {
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.font = `400 ${Math.max(8, Math.round(labelSize * 0.95))}px ${config.fontFamily}`;
    ctx.fillText(unit, x, y + valueSize * 1.45);
  }
}
function drawMetricInline(ctx, x, y, label, value, labelSize, valueSize, config, align) {
  ctx.textAlign = align;
  ctx.fillStyle = "rgba(255,255,255,0.4)";
  ctx.font = `500 ${labelSize}px ${config.fontFamily}`;
  ctx.fillText(label, x, y - valueSize * 0.95);
  ctx.fillStyle = config.textColor || "#FFFFFF";
  ctx.font = `300 ${valueSize}px ${config.fontFamily}`;
  ctx.fillText(value, x, y);
}
function drawCornerCard(ctx, x, y, width, height, label, value, unit, labelSize, valueSize, config, align) {
  ctx.fillStyle = "rgba(255,255,255,0.06)";
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, Math.max(8, height * 0.18));
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.1)";
  ctx.stroke();
  const textX = align === "left" ? x + width * 0.12 : x + width * 0.88;
  ctx.textAlign = align;
  ctx.fillStyle = "rgba(255,255,255,0.52)";
  ctx.font = `500 ${labelSize}px ${config.fontFamily}`;
  ctx.fillText(label, textX, y + height * 0.28);
  ctx.fillStyle = config.textColor || "#FFFFFF";
  ctx.font = `300 ${valueSize}px ${config.fontFamily}`;
  ctx.fillText(value, textX, y + height * 0.68);
  if (unit) {
    ctx.fillStyle = "rgba(255,255,255,0.42)";
    ctx.font = `400 ${Math.max(8, Math.round(labelSize * 0.95))}px ${config.fontFamily}`;
    ctx.fillText(unit, textX, y + height * 0.88);
  }
}
function toMetricMap(metrics) {
  const find = (label) => metrics.find((m) => m.label.toLowerCase() === label.toLowerCase())?.value;
  return {
    pace: find("Pace"),
    heartRate: find("Heart Rate"),
    distance: find("Distance"),
    time: find("Time")
  };
}
function parsePace(pace) {
  if (!pace) return 6;
  const [m = Number.NaN, s = Number.NaN] = pace.split(":").map(Number);
  if (!Number.isFinite(m) || !Number.isFinite(s)) return 6;
  return m + s / 60;
}
function getOrientation(w, h) {
  const isPortrait = h > w;
  const shortSide = Math.min(w, h);
  const longSide = Math.max(w, h);
  return {
    isPortrait,
    shortSide,
    longSide,
    safePad: shortSide * (isPortrait ? 0.04 : 0.03),
    compactPad: shortSide * (isPortrait ? 0.02 : 0.015)
  };
}

const WEBGPU_STORAGE_KEY = "enableWebGPU.v2";
const WEBGPU_FEATURE_FLAG = {
  get enabled() {
    if (typeof localStorage === "undefined") return true;
    const persisted = localStorage.getItem(WEBGPU_STORAGE_KEY);
    if (persisted === null) {
      return true;
    }
    return persisted !== "false";
  },
  toggle(enabled) {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(WEBGPU_STORAGE_KEY, enabled.toString());
    }
  }
};
class WebGPUAdapter {
  static instance = null;
  enabled = false;
  gpu = null;
  compositeResources = null;
  isInitialized = false;
  initPromise = null;
  constructor() {
    this.enabled = WEBGPU_FEATURE_FLAG.enabled;
  }
  static getInstance() {
    if (!WebGPUAdapter.instance) {
      WebGPUAdapter.instance = new WebGPUAdapter();
    }
    return WebGPUAdapter.instance;
  }
  static isSupported() {
    return typeof navigator !== "undefined" && "gpu" in navigator && navigator.gpu !== void 0;
  }
  isEnabled() {
    return this.enabled && WebGPUAdapter.isSupported();
  }
  setEnabled(enabled) {
    this.enabled = enabled;
    WEBGPU_FEATURE_FLAG.toggle(enabled);
  }
  /**
   * Initialize WebGPU resources
   */
  async initialize() {
    if (this.isInitialized) return true;
    if (this.initPromise) return this.initPromise;
    this.initPromise = this.doInitialize();
    return this.initPromise;
  }
  get2dContext(canvas) {
    return canvas.getContext("2d");
  }
  isGPUCopyExternalImageSource(source) {
    if (typeof VideoFrame !== "undefined" && source instanceof VideoFrame) return true;
    if (typeof ImageBitmap !== "undefined" && source instanceof ImageBitmap) return true;
    if (typeof OffscreenCanvas !== "undefined" && source instanceof OffscreenCanvas) return true;
    if (typeof HTMLCanvasElement !== "undefined" && source instanceof HTMLCanvasElement) return true;
    if (typeof HTMLImageElement !== "undefined" && source instanceof HTMLImageElement) return true;
    if (typeof HTMLVideoElement !== "undefined" && source instanceof HTMLVideoElement) return true;
    return false;
  }
  copyExternalSourceToTexture(texture, source, width, height) {
    if (!this.gpu || !this.isGPUCopyExternalImageSource(source)) {
      return false;
    }
    this.gpu.device.queue.copyExternalImageToTexture(
      { source },
      { texture },
      { width, height }
    );
    return true;
  }
  async doInitialize() {
    try {
      if (!WebGPUAdapter.isSupported()) {
        return false;
      }
      const adapter = await navigator.gpu.requestAdapter({
        powerPreference: "high-performance"
      });
      if (!adapter) {
        console.warn("[WebGPUAdapter] No WebGPU adapter available");
        return false;
      }
      const device = await adapter.requestDevice();
      const format = navigator.gpu.getPreferredCanvasFormat();
      const shaderModule = device.createShaderModule({
        code: this.getOverlayShaderCode()
      });
      const pipeline = device.createRenderPipeline({
        layout: "auto",
        vertex: {
          module: shaderModule,
          entryPoint: "vertexMain"
        },
        fragment: {
          module: shaderModule,
          entryPoint: "fragmentMain",
          targets: [{
            format,
            blend: {
              color: {
                srcFactor: "src-alpha",
                dstFactor: "one-minus-src-alpha",
                operation: "add"
              },
              alpha: {
                srcFactor: "one",
                dstFactor: "one-minus-src-alpha",
                operation: "add"
              }
            }
          }]
        },
        primitive: {
          topology: "triangle-list"
        }
      });
      const sampler = device.createSampler({
        magFilter: "linear",
        minFilter: "linear",
        addressModeU: "clamp-to-edge",
        addressModeV: "clamp-to-edge"
      });
      this.gpu = { adapter, device, pipeline, sampler, format };
      this.isInitialized = true;
      return true;
    } catch (error) {
      console.error("[WebGPUAdapter] Failed to initialize WebGPU:", error);
      return false;
    }
  }
  async compositeOverlay(ctx, overlaySource, videoWidth, videoHeight, overlayKey) {
    if (!this.isEnabled()) return false;
    try {
      const initialized = await this.initialize();
      if (!initialized || !this.gpu) return false;
      const resources = this.ensureCompositeResources(videoWidth, videoHeight);
      if (!resources) return false;
      if (!this.copyExternalSourceToTexture(resources.baseTexture, ctx.canvas, videoWidth, videoHeight)) {
        return false;
      }
      const shouldRefreshOverlay = overlayKey === void 0 || resources.lastOverlayKey !== overlayKey;
      if (shouldRefreshOverlay) {
        if (!this.copyExternalSourceToTexture(resources.overlayTexture, overlaySource, videoWidth, videoHeight)) {
          return false;
        }
        resources.lastOverlayKey = overlayKey ?? null;
      }
      const commandEncoder = this.gpu.device.createCommandEncoder();
      const currentTexture = resources.context.getCurrentTexture();
      const passEncoder = commandEncoder.beginRenderPass({
        colorAttachments: [
          {
            view: currentTexture.createView(),
            clearValue: { r: 0, g: 0, b: 0, a: 0 },
            loadOp: "clear",
            storeOp: "store"
          }
        ]
      });
      passEncoder.setPipeline(this.gpu.pipeline);
      passEncoder.setBindGroup(0, resources.bindGroup);
      passEncoder.draw(6, 1, 0, 0);
      passEncoder.end();
      this.gpu.device.queue.submit([commandEncoder.finish()]);
      ctx.drawImage(resources.canvas, 0, 0, videoWidth, videoHeight);
      return true;
    } catch (error) {
      console.warn("[WebGPUAdapter] compositeOverlay failed:", error);
      return false;
    }
  }
  async compositeVideoFrame(videoFrame, overlaySource, videoWidth, videoHeight, overlayKey) {
    if (!this.isEnabled()) return null;
    try {
      const initialized = await this.initialize();
      if (!initialized || !this.gpu) return null;
      const resources = this.ensureCompositeResources(videoWidth, videoHeight);
      if (!resources) return null;
      this.gpu.device.queue.copyExternalImageToTexture(
        { source: videoFrame },
        { texture: resources.baseTexture },
        { width: videoWidth, height: videoHeight }
      );
      const shouldRefreshOverlay = overlayKey === void 0 || resources.lastOverlayKey !== overlayKey;
      if (shouldRefreshOverlay) {
        if (!this.copyExternalSourceToTexture(resources.overlayTexture, overlaySource, videoWidth, videoHeight)) {
          return null;
        }
        resources.lastOverlayKey = overlayKey ?? null;
      }
      const commandEncoder = this.gpu.device.createCommandEncoder();
      const currentTexture = resources.context.getCurrentTexture();
      const passEncoder = commandEncoder.beginRenderPass({
        colorAttachments: [
          {
            view: currentTexture.createView(),
            clearValue: { r: 0, g: 0, b: 0, a: 0 },
            loadOp: "clear",
            storeOp: "store"
          }
        ]
      });
      passEncoder.setPipeline(this.gpu.pipeline);
      passEncoder.setBindGroup(0, resources.bindGroup);
      passEncoder.draw(6, 1, 0, 0);
      passEncoder.end();
      this.gpu.device.queue.submit([commandEncoder.finish()]);
      return new VideoFrame(resources.canvas, {
        timestamp: videoFrame.timestamp,
        duration: videoFrame.duration ?? void 0
      });
    } catch (error) {
      console.warn("[WebGPUAdapter] compositeVideoFrame failed:", error);
      return null;
    }
  }
  /**
   * Render overlay using WebGPU
   */
  async renderOverlay(ctx, frame, videoWidth, videoHeight, config) {
    if (!this.isEnabled()) return false;
    const overlayCanvas = this.renderOverlayToCanvas(frame, videoWidth, videoHeight, config);
    return this.compositeOverlay(
      ctx,
      overlayCanvas,
      videoWidth,
      videoHeight
    );
  }
  /**
   * Render overlay on VideoFrame
   */
  async renderOverlayOnFrame(videoFrame, telemetryFrame, config) {
    const width = videoFrame.displayWidth;
    const height = videoFrame.displayHeight;
    const canvas = this.createCanvas(width, height);
    const ctx = this.get2dContext(canvas);
    if (!ctx) return null;
    ctx.drawImage(videoFrame, 0, 0, width, height);
    const rendered = await this.renderOverlay(ctx, telemetryFrame, width, height, config);
    if (!rendered) return null;
    return new VideoFrame(canvas, {
      timestamp: videoFrame.timestamp,
      duration: videoFrame.duration ?? void 0
    });
  }
  createCanvas(width, height) {
    if (typeof OffscreenCanvas !== "undefined") {
      return new OffscreenCanvas(width, height);
    }
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }
  ensureCompositeResources(width, height) {
    if (!this.gpu) return null;
    if (this.compositeResources && this.compositeResources.width === width && this.compositeResources.height === height) {
      return this.compositeResources;
    }
    this.disposeCompositeResources();
    const canvas = this.createCanvas(width, height);
    const context = canvas.getContext("webgpu");
    if (!context) return null;
    context.configure({
      device: this.gpu.device,
      format: this.gpu.format,
      alphaMode: "premultiplied",
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC
    });
    const baseTexture = this.gpu.device.createTexture({
      size: [width, height],
      format: "rgba8unorm",
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT
    });
    const overlayTexture = this.gpu.device.createTexture({
      size: [width, height],
      format: "rgba8unorm",
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT
    });
    const uniformData = new Float32Array([1, 0, 0, 0]);
    const uniformBuffer = this.gpu.device.createBuffer({
      size: uniformData.byteLength,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });
    this.gpu.device.queue.writeBuffer(uniformBuffer, 0, uniformData);
    const bindGroup = this.gpu.device.createBindGroup({
      layout: this.gpu.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: this.gpu.sampler },
        { binding: 1, resource: baseTexture.createView() },
        { binding: 2, resource: overlayTexture.createView() },
        { binding: 3, resource: { buffer: uniformBuffer } }
      ]
    });
    this.compositeResources = {
      canvas,
      context,
      width,
      height,
      baseTexture,
      overlayTexture,
      uniformBuffer,
      bindGroup,
      lastOverlayKey: null
    };
    return this.compositeResources;
  }
  disposeCompositeResources() {
    if (!this.compositeResources) return;
    this.compositeResources.baseTexture.destroy();
    this.compositeResources.overlayTexture.destroy();
    this.compositeResources.uniformBuffer.destroy();
    this.compositeResources = null;
  }
  renderOverlayToCanvas(frame, width, height, config) {
    const overlayCanvas = this.createCanvas(width, height);
    const overlayCtx = this.get2dContext(overlayCanvas);
    if (!overlayCtx) return overlayCanvas;
    const lines = [];
    if (config.showPace && frame.paceSecondsPerKm !== void 0) {
      const pace = formatPace(frame.paceSecondsPerKm);
      if (pace) lines.push(`PACE  ${pace} min/km`);
    }
    if (config.showHr && frame.hr !== void 0) {
      lines.push(`HR    ${frame.hr} bpm`);
    }
    if (config.showDistance) {
      lines.push(`DIST  ${frame.distanceKm.toFixed(2)} km`);
    }
    if (config.showTime) {
      lines.push(`TIME  ${frame.elapsedTime}`);
    }
    if (lines.length === 0) return overlayCanvas;
    const fontSize = Math.max(14, Math.round((config.fontSizePercent || 2.4) * Math.min(width, height) / 100));
    const lineHeight = Math.round(fontSize * (config.lineSpacing || 1.2));
    const padding = Math.max(10, Math.round(fontSize * 0.7));
    overlayCtx.font = `${config.valueFontWeight || "600"} ${fontSize}px ${config.fontFamily || "sans-serif"}`;
    overlayCtx.textBaseline = "top";
    const textWidth = Math.max(...lines.map((line) => overlayCtx.measureText(line).width));
    const boxWidth = Math.ceil(textWidth + padding * 2);
    const boxHeight = Math.ceil(lineHeight * lines.length + padding * 2);
    const x = Math.max(16, Math.round(width * 0.03));
    const y = Math.max(16, height - boxHeight - Math.round(height * 0.03));
    overlayCtx.save();
    overlayCtx.globalAlpha = config.backgroundOpacity ?? 0.85;
    overlayCtx.fillStyle = config.backgroundColor || "#000000";
    const radius = Math.max(0, Math.round(config.cornerRadius || 0));
    if ("roundRect" in overlayCtx && typeof overlayCtx.roundRect === "function" && radius > 0) {
      overlayCtx.beginPath();
      overlayCtx.roundRect(x, y, boxWidth, boxHeight, radius);
      overlayCtx.fill();
    } else {
      overlayCtx.fillRect(x, y, boxWidth, boxHeight);
    }
    overlayCtx.restore();
    overlayCtx.fillStyle = config.textColor || "#FFFFFF";
    lines.forEach((line, idx) => {
      overlayCtx.fillText(line, x + padding, y + padding + idx * lineHeight);
    });
    return overlayCanvas;
  }
  /**
   * Get WGSL shader code for overlay rendering
   */
  getOverlayShaderCode() {
    return `
      struct VertexOutput {
        @builtin(position) position: vec4f,
        @location(0) uv: vec2f,
      };

      struct Uniforms {
        overlayOpacity: f32,
        padding0: f32,
        padding1: f32,
        padding2: f32,
      };
      
      @vertex
      fn vertexMain(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
        const pos = array(
          vec2f(-1.0, -1.0), vec2f(-1.0, 1.0), vec2f(1.0, -1.0),
          vec2f(1.0, -1.0), vec2f(-1.0, 1.0), vec2f(1.0, 1.0)
        );
        const uv = array(
          vec2f(0.0, 1.0), vec2f(0.0, 0.0), vec2f(1.0, 1.0),
          vec2f(1.0, 1.0), vec2f(0.0, 0.0), vec2f(1.0, 0.0)
        );
        
        var output: VertexOutput;
        output.position = vec4f(pos[vertexIndex], 0.0, 1.0);
        output.uv = uv[vertexIndex];
        return output;
      }
      
      @group(0) @binding(0) var textureSampler: sampler;
      @group(0) @binding(1) var baseTexture: texture_2d<f32>;
      @group(0) @binding(2) var overlayTexture: texture_2d<f32>;
      @group(0) @binding(3) var<uniform> uniforms: Uniforms;
      
      @fragment
      fn fragmentMain(input: VertexOutput) -> @location(0) vec4f {
        let base = textureSample(baseTexture, textureSampler, input.uv);
        let overlay = textureSample(overlayTexture, textureSampler, input.uv);
        let overlayAlpha = overlay.a * uniforms.overlayOpacity;

        let rgb = mix(base.rgb, overlay.rgb, overlayAlpha);
        let outAlpha = max(base.a, overlayAlpha);
        return vec4f(rgb, outAlpha);
      }
    `;
  }
  /**
   * Clean up resources
   */
  dispose() {
    this.disposeCompositeResources();
    this.gpu?.device.destroy();
    this.gpu = null;
    this.isInitialized = false;
    this.initPromise = null;
  }
}
function getWebGPUStatus() {
  const supported = WebGPUAdapter.isSupported();
  const adapter = WebGPUAdapter.getInstance();
  const enabled = adapter.isEnabled();
  return {
    supported,
    enabled,
    available: supported && enabled
  };
}
function toggleWebGPU(enabled) {
  const adapter = WebGPUAdapter.getInstance();
  adapter.setEnabled(enabled);
}
function isWebGPUAvailable() {
  const status = getWebGPUStatus();
  return status.available;
}

const webgpuAdapter = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  WEBGPU_FEATURE_FLAG,
  WebGPUAdapter,
  getWebGPUStatus,
  isWebGPUAvailable,
  toggleWebGPU
}, Symbol.toStringTag, { value: 'Module' }));

const overlayCache = /* @__PURE__ */ new Map();
const scratchOverlays = /* @__PURE__ */ new WeakMap();
const MAX_CACHE_ENTRIES = 200;
const MAX_CACHE_PIXELS = 1280 * 720;
const DEFAULT_OVERLAY_CONFIG = {
  templateId: "horizon",
  layoutMode: "bottom-bar",
  position: "bottom-left",
  backgroundOpacity: 0.85,
  fontSizePercent: 2.4,
  showHr: true,
  showPace: true,
  showDistance: true,
  showTime: true,
  fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  textColor: "#FFFFFF",
  backgroundColor: "#000000",
  borderWidth: 0,
  borderColor: "transparent",
  cornerRadius: 0,
  textShadow: false,
  textShadowColor: "#000000",
  textShadowBlur: 0,
  lineSpacing: 1.2,
  layout: "horizontal",
  iconStyle: "none",
  gradientBackground: true,
  gradientStartColor: "rgba(0,0,0,0)",
  gradientEndColor: "rgba(0,0,0,0.9)",
  labelStyle: "uppercase",
  valueFontWeight: "bold",
  valueSizeMultiplier: 2.5,
  labelSizeMultiplier: 0.4,
  labelLetterSpacing: 0.15,
  accentColor: "#ef4444"
};
async function renderOverlay(ctx, frame, videoWidth, videoHeight, config = DEFAULT_OVERLAY_CONFIG) {
  const effectiveConfig = getEffectiveConfig(config);
  const metrics = buildMetrics(frame, effectiveConfig);
  if (metrics.length === 0) {
    return;
  }
  const shouldUseCache = videoWidth * videoHeight <= MAX_CACHE_PIXELS;
  const cacheKey = shouldUseCache ? buildCacheKey(metrics, effectiveConfig, videoWidth, videoHeight) : void 0;
  if (cacheKey) {
    const cached = overlayCache.get(cacheKey);
    if (cached) {
      ctx.drawImage(cached.canvas, 0, 0);
      return;
    }
  }
  const overlayTarget = createOverlayTarget(ctx, videoWidth, videoHeight);
  if (!overlayTarget) return;
  const { canvas: overlayCanvas, ctx: overlayCtx } = overlayTarget;
  if (typeof overlayCtx.clearRect === "function") {
    overlayCtx.clearRect(0, 0, videoWidth, videoHeight);
  }
  const layoutMode = effectiveConfig.layoutMode || "box";
  renderLayout(overlayCtx, metrics, frame, videoWidth, videoHeight, effectiveConfig, layoutMode);
  if (cacheKey) {
    cacheOverlay(cacheKey, overlayCanvas, videoWidth, videoHeight);
  }
  let composited = false;
  if (WebGPUAdapter.isSupported()) {
    try {
      const adapter = WebGPUAdapter.getInstance();
      if (adapter.isEnabled()) {
        composited = await adapter.compositeOverlay(
          ctx,
          overlayCanvas,
          videoWidth,
          videoHeight,
          cacheKey
        );
      }
    } catch (error) {
      console.warn("WebGPU compositing failed, falling back to Canvas 2D:", error);
    }
  }
  if (!composited) {
    ctx.drawImage(overlayCanvas, 0, 0);
  }
}
function getEffectiveConfig(config) {
  if (config.templateId && config.templateId !== "custom") {
    const templateConfig = getTemplateConfig(config.templateId);
    return { ...templateConfig, ...config };
  }
  return config;
}
function renderLayout(ctx, metrics, frame, w, h, config, layoutMode) {
  switch (layoutMode) {
    case "bottom-bar":
      renderHorizonLayout(ctx, metrics, w, h, config);
      break;
    case "side-margins":
      renderMarginLayout(ctx, metrics, w, h, config);
      break;
    case "corner-frame":
      renderLFrameLayout(ctx, metrics, frame, w, h, config);
      break;
    case "box":
      renderClassicLayout(ctx, metrics, w, h, config);
      break;
    case "floating-pills":
    case "arc-gauge":
    case "hero-number":
    case "dashboard-hud":
    case "cinematic-bar":
    case "split-edges":
    case "stacked-serif":
    case "editorial":
    case "ticker-tape":
    case "whisper":
    case "two-tone":
    case "condensed-strip":
    case "soft-rounded":
    case "thin-line":
    case "swiss-grid":
      renderExtendedLayout(ctx, metrics, w, h, config, layoutMode);
      break;
    default:
      renderClassicLayout(ctx, metrics, w, h, config);
      break;
  }
}
function buildMetrics(frame, config) {
  const items = [];
  if (config.showPace && frame.paceSecondsPerKm !== void 0) {
    const paceStr = formatPace(frame.paceSecondsPerKm);
    if (paceStr) items.push({ label: "Pace", value: paceStr, unit: "min/km" });
  }
  if (config.showHr && frame.hr !== void 0) {
    items.push({ label: "Heart Rate", value: String(frame.hr), unit: "bpm" });
  }
  if (config.showDistance) {
    items.push({ label: "Distance", value: frame.distanceKm.toFixed(1), unit: "km" });
  }
  if (config.showTime) {
    items.push({ label: "Time", value: frame.elapsedTime, unit: "" });
  }
  return items;
}
function buildCacheKey(metrics, config, width, height) {
  return JSON.stringify({
    metrics,
    pos: config.position,
    opacity: config.backgroundOpacity,
    font: config.fontSizePercent,
    showHr: config.showHr,
    showPace: config.showPace,
    showDistance: config.showDistance,
    showTime: config.showTime,
    templateId: config.templateId,
    layoutMode: config.layoutMode,
    fontFamily: config.fontFamily,
    textColor: config.textColor,
    backgroundColor: config.backgroundColor,
    valueFontWeight: config.valueFontWeight,
    valueSizeMultiplier: config.valueSizeMultiplier,
    accentColor: config.accentColor,
    width,
    height
  });
}
function cacheOverlay(key, sourceCanvas, width, height) {
  if (overlayCache.size >= MAX_CACHE_ENTRIES) {
    const firstKey = overlayCache.keys().next().value;
    if (firstKey) overlayCache.delete(firstKey);
  }
  const cacheCanvas = createCanvas(width, height);
  const cacheCtx = getCanvasContext(cacheCanvas);
  if (!cacheCtx) return;
  cacheCtx.drawImage(sourceCanvas, 0, 0);
  overlayCache.set(key, { canvas: cacheCanvas });
}
function createOverlayTarget(destinationCtx, width, height) {
  const key = destinationCtx.canvas;
  const cached = scratchOverlays.get(key);
  if (cached && cached.width === width && cached.height === height) {
    return { canvas: cached.canvas, ctx: cached.ctx };
  }
  const canvas = createCanvas(width, height);
  const ctx = getCanvasContext(canvas);
  if (!ctx) return null;
  scratchOverlays.set(key, { canvas, ctx, width, height });
  return { canvas, ctx };
}
function createCanvas(width, height) {
  const canvas = typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(width, height) : document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}
function getCanvasContext(canvas) {
  if (canvas instanceof OffscreenCanvas) {
    return canvas.getContext("2d");
  }
  return canvas.getContext("2d");
}

const useSettingsStore = defineStore("settings", () => {
  const currentScreen = ref("upload");
  const overlayConfig = ref({ ...DEFAULT_OVERLAY_CONFIG });
  const isUploadScreen = computed(() => currentScreen.value === "upload");
  const isPreviewScreen = computed(() => currentScreen.value === "preview");
  const isProcessingScreen = computed(() => currentScreen.value === "processing");
  const isResultScreen = computed(() => currentScreen.value === "result");
  const currentTemplateId = computed(() => overlayConfig.value.templateId);
  function setScreen(screen) {
    currentScreen.value = screen;
  }
  function updateOverlayConfig(updates) {
    const next = { ...updates };
    if (next.position !== void 0 && overlayConfig.value.templateId !== "classic") {
      delete next.position;
    }
    overlayConfig.value = { ...overlayConfig.value, ...next };
  }
  function resetOverlayConfig() {
    overlayConfig.value = { ...DEFAULT_OVERLAY_CONFIG };
  }
  function selectTemplate(templateId) {
    const templateConfig = getTemplateConfig(templateId);
    const userOverrides = {};
    if (overlayConfig.value.templateId === "custom" && templateId === "classic") {
      userOverrides.position = overlayConfig.value.position;
      userOverrides.showHr = overlayConfig.value.showHr;
      userOverrides.showPace = overlayConfig.value.showPace;
      userOverrides.showDistance = overlayConfig.value.showDistance;
      userOverrides.showTime = overlayConfig.value.showTime;
    } else if (overlayConfig.value.templateId === "custom") {
      userOverrides.showHr = overlayConfig.value.showHr;
      userOverrides.showPace = overlayConfig.value.showPace;
      userOverrides.showDistance = overlayConfig.value.showDistance;
      userOverrides.showTime = overlayConfig.value.showTime;
    }
    overlayConfig.value = { ...templateConfig, ...userOverrides };
  }
  function saveAsCustomTemplate() {
    overlayConfig.value = {
      ...overlayConfig.value,
      templateId: "custom"
    };
  }
  function resetToTemplateDefaults() {
    if (overlayConfig.value.templateId !== "custom") {
      selectTemplate(overlayConfig.value.templateId);
    }
  }
  function reset() {
    currentScreen.value = "upload";
    overlayConfig.value = { ...DEFAULT_OVERLAY_CONFIG };
  }
  return {
    currentScreen,
    overlayConfig,
    currentTemplateId,
    isUploadScreen,
    isPreviewScreen,
    isProcessingScreen,
    isResultScreen,
    setScreen,
    updateOverlayConfig,
    resetOverlayConfig,
    selectTemplate,
    saveAsCustomTemplate,
    resetToTemplateDefaults,
    reset
  };
});

const createApp = ViteSSG(
  App,
  { routes },
  ({ app, initialState, isClient }) => {
    const pinia = createPinia();
    app.use(pinia);
    if (isClient) {
      pinia.state.value = initialState.pinia || {};
    } else {
      initialState.pinia = pinia.state.value;
    }
  }
);

export { DEFAULT_OVERLAY_CONFIG as D, ProcessingError as P, _export_sfc as _, useSettingsStore as a, getSyncRangeSeconds as b, checkBrowserCapabilities as c, createApp, getAllTemplateMetadata as d, useSyncStore as e, buildTelemetryTimeline as f, getTelemetryAtTime as g, createProcessingProgressReporter as h, createMuxProgressReporter as i, useProcessingStore as j, getWebGPUStatus as k, normalizeProcessingError as n, renderOverlay as r, useFilesStore as u, webgpuAdapter as w };
