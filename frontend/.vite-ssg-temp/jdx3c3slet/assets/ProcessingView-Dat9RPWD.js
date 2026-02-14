import { defineComponent, computed, mergeProps, useSSRContext, ref, onMounted, watch, unref } from 'vue';
import { ssrRenderAttrs, ssrInterpolate, ssrRenderStyle, ssrRenderClass, ssrRenderComponent } from 'vue/server-renderer';
import { useRouter } from 'vue-router';
import { P as ProcessingError, D as DEFAULT_OVERLAY_CONFIG, g as getTelemetryAtTime, r as renderOverlay, h as createProcessingProgressReporter, i as createMuxProgressReporter, _ as _export_sfc, u as useFilesStore, j as useProcessingStore, a as useSettingsStore, e as useSyncStore, k as getWebGPUStatus, f as buildTelemetryTimeline, n as normalizeProcessingError } from '../main.mjs';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';
import { Input, BlobSource, ALL_FORMATS, EncodedPacketSink, Output, BufferTarget, Mp4OutputFormat, EncodedVideoPacketSource, EncodedAudioPacketSource, EncodedPacket } from 'mediabunny';
import { u as useSeo } from './useSeo-BEvayQdz.js';
import '@unhead/vue/server';
import 'pinia';
import '@unhead/vue';

const DEFAULT_CORE_CANDIDATES = [
  "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm",
  "https://unpkg.com/@ffmpeg/core@0.12.10/dist/esm"
];
const LOCAL_VENDOR_PATH = "/vendor/ffmpeg";
async function loadFfmpegCore(ffmpeg, candidates = DEFAULT_CORE_CANDIDATES, deps = {}) {
  const fetchFn = deps.fetchFn ?? fetch;
  const toBlobUrlFn = deps.toBlobUrlFn ?? toBlobURL;
  const attemptErrors = [];
  const augmentedCandidates = [LOCAL_VENDOR_PATH, ...candidates];
  for (const baseURL of augmentedCandidates) {
    const diagnostics = await probeFfmpegCore(baseURL, fetchFn);
    try {
      if (baseURL.startsWith("http")) {
        try {
          await ffmpeg.load({
            coreURL: `${baseURL}/ffmpeg-core.js`,
            wasmURL: `${baseURL}/ffmpeg-core.wasm`
          });
          return void 0;
        } catch {
        }
      }
      const coreUrl = await toBlobUrlFn(`${baseURL}/ffmpeg-core.js`, "text/javascript");
      const wasmUrl = await toBlobUrlFn(`${baseURL}/ffmpeg-core.wasm`, "application/wasm");
      await ffmpeg.load({ coreURL: coreUrl, wasmURL: wasmUrl });
      return void 0;
    } catch (err) {
      console.warn(`[ffmpeg core] failed to load from ${baseURL}`);
      if (diagnostics.length) {
        console.warn(`[ffmpeg core diagnostics] ${baseURL}
` + diagnostics.join("\n"));
        attemptErrors.push(`[${baseURL}] diagnostics:
${diagnostics.join("\n")}`);
      }
      attemptErrors.push(`[${baseURL}] error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return new Error("Failed to load ffmpeg core from all candidates: " + attemptErrors.join("\n---\n"));
}
async function probeFfmpegCore(baseURL, fetchFn = fetch) {
  const diagnostics = [];
  try {
    const probeResp = await fetchFn(`${baseURL}/ffmpeg-core.js`, { method: "GET", mode: "cors" });
    diagnostics.push(`ffmpeg-core.js -> ${probeResp.status} ${probeResp.statusText}`);
    diagnostics.push(`content-type: ${probeResp.headers.get("content-type")}`);
    diagnostics.push(`access-control-allow-origin: ${probeResp.headers.get("access-control-allow-origin")}`);
  } catch (probeErr) {
    diagnostics.push(`probe failed: ${probeErr instanceof Error ? probeErr.message : String(probeErr)}`);
  }
  try {
    const wasmProbe = await fetchFn(`${baseURL}/ffmpeg-core.wasm`, { method: "GET", mode: "cors" });
    diagnostics.push(`ffmpeg-core.wasm -> ${wasmProbe.status} ${wasmProbe.statusText}`);
    diagnostics.push(`wasm content-type: ${wasmProbe.headers.get("content-type")}`);
  } catch (probeErr) {
    diagnostics.push(`wasm probe failed: ${probeErr instanceof Error ? probeErr.message : String(probeErr)}`);
  }
  return diagnostics;
}
function createFfmpegInstance(factory = () => new FFmpeg()) {
  const ffmpeg = factory();
  return ffmpeg;
}
async function remuxWithFfmpeg(inputBlob, deps = {}) {
  const ffmpeg = createFfmpegInstance(deps.ffmpegFactory);
  const loadError = await loadFfmpegCore(ffmpeg, DEFAULT_CORE_CANDIDATES, deps.coreDeps);
  if (loadError) throw loadError;
  const inputData = new Uint8Array(await inputBlob.arrayBuffer());
  await ffmpeg.writeFile("input.mp4", inputData);
  await ffmpeg.exec(["-i", "input.mp4", "-c", "copy", "-map_metadata", "-1", "output.mp4"]);
  const output = await ffmpeg.readFile("output.mp4");
  const outputData = output instanceof Uint8Array ? output : new Uint8Array(output);
  return new Blob([outputData.slice().buffer], { type: "video/mp4" });
}
async function transcodeWithForcedKeyframes(file, _meta, options, deps = {}) {
  const { gopSize, onProgress } = options;
  const ffmpeg = createFfmpegInstance(deps.ffmpegFactory);
  const logBuffer = [];
  const attemptLogs = [];
  ffmpeg.on("log", ({ message }) => {
    logBuffer.push(message);
    if (logBuffer.length > 50) logBuffer.shift();
  });
  ffmpeg.on("progress", ({ progress, time }) => {
    const percent = Number.isFinite(progress) ? Math.round(progress * 100) : 0;
    onProgress?.(percent, time);
  });
  const loadError = await loadFfmpegCore(ffmpeg, DEFAULT_CORE_CANDIDATES, deps.coreDeps);
  if (loadError) throw loadError;
  const inputData = new Uint8Array(await file.arrayBuffer());
  await ffmpeg.writeFile("input.mp4", inputData);
  const forceKeyframesExpr = "expr:gte(t,n_forced*1)";
  const x264Params = `keyint=${gopSize}:min-keyint=${gopSize}:scenecut=0:open-gop=0`;
  const baseArgs = [
    "-i",
    "input.mp4",
    "-c:v",
    "libx264",
    "-preset",
    "ultrafast",
    "-crf",
    "23",
    "-tune",
    "zerolatency",
    "-pix_fmt",
    "yuv420p",
    "-g",
    `${gopSize}`,
    "-keyint_min",
    `${gopSize}`,
    "-sc_threshold",
    "0",
    "-bf",
    "0",
    "-refs",
    "1",
    "-x264-params",
    x264Params,
    "-force_key_frames",
    forceKeyframesExpr,
    "-movflags",
    "+faststart"
  ];
  const runTranscode = async (args, label) => {
    logBuffer.length = 0;
    try {
      await ffmpeg.exec(args);
    } catch (error) {
      if (logBuffer.length > 0) {
        attemptLogs.push(`[${label}]
${logBuffer.join("\n")}`);
      }
      console.warn(`[ffmpeg transcode] ${label} failed`);
      throw error;
    }
  };
  try {
    await runTranscode([...baseArgs, "-c:a", "copy", "output.mp4"], "audio-copy");
  } catch {
    try {
      await runTranscode([...baseArgs, "-c:a", "aac", "-b:a", "256k", "output.mp4"], "audio-aac");
    } catch (secondError) {
      console.error("[ffmpeg transcode] both attempts failed", { attemptLogs });
      throw new ProcessingError(
        `FFmpeg transcode failed: ${secondError instanceof Error ? secondError.message : "Unknown error"}`,
        attemptLogs.length > 0 ? { details: attemptLogs.join("\n\n") } : void 0
      );
    }
  }
  const output = await ffmpeg.readFile("output.mp4");
  const outputData = output instanceof Uint8Array ? output : new Uint8Array(output);
  const fileName = file.name.replace(/\.[^/.]+$/, "") + ".keyframes.mp4";
  return new File([outputData.slice().buffer], fileName, { type: "video/mp4" });
}

function createKeyframeDetector(codec, description) {
  const codecLower = codec.toLowerCase();
  const isH264 = codecLower.startsWith("avc1") || codecLower.startsWith("avc3");
  const isH265 = codecLower.startsWith("hvc1") || codecLower.startsWith("hev1");
  const nalLengthSize = getNalLengthSize(codecLower, description);
  let detectedNalLengthSize = nalLengthSize;
  return (sample) => {
    if (sample.is_rap) return true;
    const data = new Uint8Array(sample.data);
    if (data.length < 5) return false;
    if (!detectedNalLengthSize) {
      detectedNalLengthSize = detectNalLengthSizeFromSample(data);
    }
    if (detectedNalLengthSize) {
      return containsKeyframeNal(data, detectedNalLengthSize, isH264, isH265);
    }
    return containsAnnexBKeyframe(data, isH264, isH265);
  };
}
function detectSourceGopSize(samples, fps) {
  const rapIndexes = [];
  for (let i = 0; i < samples.length; i += 1) {
    if (samples[i]?.is_rap) rapIndexes.push(i);
    if (rapIndexes.length >= 16) break;
  }
  if (rapIndexes.length >= 3) {
    const deltas = [];
    for (let i = 1; i < rapIndexes.length; i += 1) {
      const delta = rapIndexes[i] - rapIndexes[i - 1];
      if (delta > 0) deltas.push(delta);
    }
    if (deltas.length > 0) {
      const average = Math.round(deltas.reduce((sum, v) => sum + v, 0) / deltas.length);
      return Math.max(1, Math.min(300, average));
    }
  }
  const fallback = Math.max(1, Math.round(fps / 2));
  return Math.min(300, fallback);
}
function getNalLengthSize(codecLower, description) {
  if (!description) return void 0;
  const buffer = normalizeToArrayBuffer(description);
  const view = new DataView(buffer);
  if ((codecLower.startsWith("avc1") || codecLower.startsWith("avc3")) && view.byteLength >= 5) {
    const lengthSizeMinusOne = view.getUint8(4) & 3;
    return lengthSizeMinusOne + 1;
  }
  if ((codecLower.startsWith("hvc1") || codecLower.startsWith("hev1")) && view.byteLength >= 22) {
    const lengthSizeMinusOne = view.getUint8(21) & 3;
    return lengthSizeMinusOne + 1;
  }
  return void 0;
}
function normalizeToArrayBuffer(source) {
  if (source instanceof ArrayBuffer) {
    return source;
  }
  if (ArrayBuffer.isView(source)) {
    const bytes = new Uint8Array(source.buffer, source.byteOffset, source.byteLength);
    return bytes.slice().buffer;
  }
  return new Uint8Array(source).slice().buffer;
}
function detectNalLengthSizeFromSample(data) {
  if (data.length < 5) return void 0;
  const candidateSizes = [4, 3, 2, 1];
  for (const size of candidateSizes) {
    if (data.length <= size) continue;
    let nalSize = 0;
    for (let i = 0; i < size; i += 1) {
      const byte = data[i];
      if (byte === void 0) return void 0;
      nalSize = nalSize << 8 | byte;
    }
    if (nalSize <= 0 || size + nalSize > data.length) continue;
    const nextOffset = size + nalSize;
    if (nextOffset + size <= data.length) {
      let nextSize = 0;
      for (let i = 0; i < size; i += 1) {
        const byte = data[nextOffset + i];
        if (byte === void 0) return size;
        nextSize = nextSize << 8 | byte;
      }
      if (nextSize > 0 && nextOffset + size + nextSize <= data.length) {
        return size;
      }
    } else {
      return size;
    }
  }
  return void 0;
}
function containsKeyframeNal(data, nalLengthSize, isH264, isH265) {
  let offset = 0;
  while (offset + nalLengthSize <= data.length) {
    let nalSize = 0;
    for (let i = 0; i < nalLengthSize; i += 1) {
      const byte = data[offset + i];
      if (byte === void 0) return false;
      nalSize = nalSize << 8 | byte;
    }
    offset += nalLengthSize;
    if (nalSize <= 0 || offset + nalSize > data.length) break;
    const nalHeader = data[offset];
    if (nalHeader !== void 0 && isNalKeyframe(nalHeader, isH264, isH265)) return true;
    offset += nalSize;
  }
  return false;
}
function containsAnnexBKeyframe(data, isH264, isH265) {
  let i = 0;
  while (i + 3 < data.length) {
    const isStartCode3 = data[i] === 0 && data[i + 1] === 0 && data[i + 2] === 1;
    const isStartCode4 = i + 4 < data.length && data[i] === 0 && data[i + 1] === 0 && data[i + 2] === 0 && data[i + 3] === 1;
    if (isStartCode3 || isStartCode4) {
      const nalHeaderIndex = i + (isStartCode4 ? 4 : 3);
      if (nalHeaderIndex < data.length) {
        const nalHeader = data[nalHeaderIndex];
        if (nalHeader !== void 0 && isNalKeyframe(nalHeader, isH264, isH265)) return true;
      }
      i = nalHeaderIndex;
    } else {
      i += 1;
    }
  }
  return false;
}
function isNalKeyframe(nalHeader, isH264, isH265) {
  if (isH264) {
    const nalType = nalHeader & 31;
    return nalType === 5;
  }
  if (isH265) {
    const nalType = nalHeader >> 1 & 63;
    return nalType >= 16 && nalType <= 21;
  }
  return false;
}

const FFMPEG_FALLBACK_MAX_FILE_SIZE_BYTES = 1024 * 1024 * 1024;
function createDemuxer() {
  return {
    async demux(file) {
      const input = new Input({
        formats: ALL_FORMATS,
        source: new BlobSource(file)
      });
      try {
        const videoTrack = await input.getPrimaryVideoTrack();
        const audioTrack = await input.getPrimaryAudioTrack();
        if (!videoTrack) {
          throw new ProcessingError("No video track found in the file");
        }
        const videoCodecString = await videoTrack.getCodecParameterString() ?? (await videoTrack.getDecoderConfig())?.codec ?? "unknown";
        let videoDecoderConfig;
        try {
          videoDecoderConfig = await videoTrack.getDecoderConfig() ?? void 0;
        } catch {
          videoDecoderConfig = void 0;
        }
        const videoCodecName = String(videoTrack.codec ?? "").toLowerCase();
        const videoSink = new EncodedPacketSink(videoTrack);
        const videoSamples = [];
        for await (const packet of videoSink.packets()) {
          const timestampUs = Math.round(packet.timestamp * 1e6);
          const durationUs = Math.max(1, Math.round(packet.duration * 1e6));
          const data = toTightArrayBuffer(packet.data);
          videoSamples.push({
            data,
            duration: durationUs,
            dts: timestampUs,
            cts: timestampUs,
            timescale: 1e6,
            is_rap: packet.type === "key"
          });
        }
        const videoSinkClosable = videoSink;
        videoSinkClosable.close?.();
        let parsedAudioTrack;
        const audioSamples = [];
        if (audioTrack) {
          const audioCodecString = await audioTrack.getCodecParameterString() ?? (await audioTrack.getDecoderConfig())?.codec ?? "unknown";
          let audioDecoderConfig;
          try {
            audioDecoderConfig = await audioTrack.getDecoderConfig() ?? void 0;
          } catch {
            audioDecoderConfig = void 0;
          }
          const audioSink = new EncodedPacketSink(audioTrack);
          for await (const packet of audioSink.packets()) {
            const timestampUs = Math.round(packet.timestamp * 1e6);
            const durationUs = Math.max(1, Math.round(packet.duration * 1e6));
            const data = toTightArrayBuffer(packet.data);
            audioSamples.push({
              data,
              duration: durationUs,
              dts: timestampUs,
              cts: timestampUs,
              timescale: 1e6,
              is_rap: packet.type === "key"
            });
          }
          const audioSinkClosable = audioSink;
          audioSinkClosable.close?.();
          parsedAudioTrack = {
            id: 2,
            codec: audioCodecString,
            codecName: String(audioTrack.codec ?? "").toLowerCase(),
            timescale: 1e6,
            decoderConfig: audioDecoderConfig,
            audio: {
              channel_count: audioTrack.numberOfChannels,
              sample_rate: audioTrack.sampleRate
            }
          };
        }
        return {
          videoTrack: {
            id: 1,
            codec: videoCodecString,
            codecName: videoCodecName,
            description: videoDecoderConfig?.description,
            timescale: 1e6,
            decoderConfig: videoDecoderConfig
          },
          audioTrack: parsedAudioTrack,
          videoSamples,
          audioSamples
        };
      } catch (error) {
        const details = error instanceof Error ? { cause: error.message } : { cause: String(error) };
        throw error instanceof ProcessingError ? error : new ProcessingError("Failed to parse media tracks with Mediabunny", details);
      } finally {
        const disposable = input;
        try {
          disposable[Symbol.dispose]?.();
        } catch {
        }
      }
    },
    async demuxWithFallback(file, onProgress) {
      try {
        const result = await this.demux(file);
        if (result.videoSamples.length > 0) return result;
        throw new ProcessingError("Parser returned zero video samples");
      } catch (firstError) {
        console.warn("[demux] Direct parse failed, trying FFmpeg remux", firstError);
      }
      if (file.size >= FFMPEG_FALLBACK_MAX_FILE_SIZE_BYTES) {
        throw new ProcessingError(
          "Failed to parse the source container. Automatic FFmpeg repair is disabled for files larger than 1 GB to avoid browser freezes."
        );
      }
      try {
        onProgress?.({ phase: "demuxing", percent: 0, framesProcessed: 0, totalFrames: 0 });
        const remuxedBlob = await remuxWithFfmpeg(file);
        const fileName = file.name.replace(/\.[^/.]+$/, "") + ".mp4";
        const remuxedFile = new File([remuxedBlob], fileName, { type: "video/mp4" });
        return await this.demux(remuxedFile);
      } catch (secondError) {
        throw new ProcessingError(
          "Failed to parse the video file. The file may contain unsupported metadata or be corrupted. Automatic repair did not succeed."
        );
      }
    }
  };
}
function toTightArrayBuffer(data) {
  if (data.byteOffset === 0 && data.byteLength === data.buffer.byteLength) {
    return data.buffer;
  }
  return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
}

function getCodecCandidates(meta, sourceCodec) {
  const sourceCodecLower = sourceCodec.toLowerCase();
  const avcCandidates = getAvcCodecCandidates(meta);
  if (sourceCodecLower.startsWith("hvc1") || sourceCodecLower.startsWith("hev1")) {
    return [
      "hvc1.1.6.L153.B0",
      "hev1.1.6.L153.B0",
      "hvc1.1.6.L123.B0",
      "hev1.1.6.L123.B0",
      ...avcCandidates
    ];
  }
  if (sourceCodecLower.startsWith("av01")) {
    return ["av01.0.12M.08", ...avcCandidates];
  }
  if (sourceCodecLower.startsWith("vp09")) {
    return ["vp09.00.41.08", ...avcCandidates];
  }
  return avcCandidates;
}
function getAvcCodecCandidates(meta) {
  const pixels = meta.width * meta.height;
  if (pixels > 4096 * 2304) {
    return ["avc1.640034", "avc1.640033", "avc1.640032", "avc1.64002A", "avc1.640029", "avc1.640028"];
  }
  if (pixels > 1920 * 1080) {
    return ["avc1.640033", "avc1.640032", "avc1.64002A", "avc1.640029", "avc1.640028"];
  }
  return ["avc1.640029", "avc1.640028"];
}
function scaleToMaxArea(meta, maxArea) {
  const area = meta.width * meta.height;
  if (area <= maxArea) return { ...meta };
  const scale = Math.sqrt(maxArea / area);
  const width = Math.max(2, Math.floor(meta.width * scale));
  const height = Math.max(2, Math.floor(meta.height * scale));
  return { ...meta, width, height };
}
function estimateBitrateBaseline(meta) {
  const pixels = meta.width * meta.height;
  if (pixels >= 3840 * 2160) return 35e6;
  if (pixels >= 1920 * 1080) return 15e6;
  if (pixels >= 1280 * 720) return 8e6;
  return 5e6;
}
function estimateTargetBitrate(sourceMeta, targetMeta, sourceFileSize) {
  const sourceDuration = Math.max(1, sourceMeta.duration || 1);
  const sourceBitrate = Math.round(sourceFileSize * 8 / sourceDuration);
  const sourcePixels = Math.max(1, sourceMeta.width * sourceMeta.height);
  const targetPixels = Math.max(1, targetMeta.width * targetMeta.height);
  const pixelScale = targetPixels / sourcePixels;
  const scaledSourceBitrate = Math.round(sourceBitrate * Math.min(1, pixelScale));
  const baseline = estimateBitrateBaseline(targetMeta);
  const target = Math.max(scaledSourceBitrate, baseline);
  return Math.min(14e7, Math.max(5e6, target));
}
function toMediabunnyVideoCodec(codec) {
  const normalized = codec.toLowerCase();
  if (normalized.startsWith("avc1") || normalized.startsWith("avc3")) return "avc";
  if (normalized.startsWith("hvc1") || normalized.startsWith("hev1")) return "hevc";
  if (normalized.startsWith("vp09")) return "vp9";
  if (normalized.startsWith("vp08")) return "vp8";
  if (normalized.startsWith("av01")) return "av1";
  return "avc";
}
function toMediabunnyAudioCodec(codec) {
  const normalized = codec.toLowerCase();
  if (normalized.startsWith("mp4a")) return "aac";
  if (normalized.startsWith("opus")) return "opus";
  if (normalized.startsWith("mp3")) return "mp3";
  if (normalized.startsWith("flac")) return "flac";
  return "aac";
}

function createMuxer() {
  return {
    async muxMp4(demuxed, encodedChunks, decoderConfig, meta, onMuxProgress) {
      const muxWithMode = async (includeAudio) => {
        const output = new Output({
          format: new Mp4OutputFormat(),
          target: new BufferTarget()
        });
        const videoCodec = decoderConfig?.codec ?? demuxed.videoTrack.codec;
        const videoSource = new EncodedVideoPacketSource(toMediabunnyVideoCodec(videoCodec));
        output.addVideoTrack(videoSource, { frameRate: meta.fps });
        let audioSource;
        if (includeAudio && demuxed.audioTrack) {
          audioSource = new EncodedAudioPacketSource(
            toMediabunnyAudioCodec(demuxed.audioTrack.codec)
          );
          output.addAudioTrack(audioSource);
        }
        await output.start();
        onMuxProgress?.(2);
        const totalUnits = encodedChunks.length + (includeAudio && demuxed.audioSamples.length ? demuxed.audioSamples.length : 0);
        let doneUnits = 0;
        const reportUnitProgress = () => {
          if (totalUnits <= 0) {
            onMuxProgress?.(95);
            return;
          }
          const unitsPercent = Math.min(95, Math.round(doneUnits / totalUnits * 95));
          onMuxProgress?.(unitsPercent);
        };
        let firstVideoPacket = true;
        for (const chunk of encodedChunks) {
          const packet = EncodedPacket.fromEncodedChunk(chunk);
          if (firstVideoPacket) {
            await videoSource.add(packet, {
              decoderConfig
            });
            firstVideoPacket = false;
          } else {
            await videoSource.add(packet);
          }
          doneUnits += 1;
          reportUnitProgress();
        }
        if (audioSource && demuxed.audioSamples.length) {
          let firstAudioPacket = true;
          for (const sample of demuxed.audioSamples) {
            const chunk = new EncodedAudioChunk({
              type: sample.is_rap ? "key" : "delta",
              timestamp: sample.cts,
              duration: sample.duration,
              data: new Uint8Array(sample.data)
            });
            const packet = EncodedPacket.fromEncodedChunk(chunk);
            if (firstAudioPacket) {
              await audioSource.add(packet, {
                decoderConfig: demuxed.audioTrack?.decoderConfig
              });
              firstAudioPacket = false;
            } else {
              await audioSource.add(packet);
            }
            doneUnits += 1;
            reportUnitProgress();
          }
        }
        onMuxProgress?.(98);
        await output.finalize();
        onMuxProgress?.(100);
        const buffer = output.target.buffer;
        if (!buffer || buffer.byteLength === 0) {
          throw new ProcessingError("Mediabunny mux produced empty output");
        }
        return new Blob([buffer], { type: "video/mp4" });
      };
      try {
        return await muxWithMode(true);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const isContainerError = /stco|isobmff|mux|container|track/i.test(message);
        if (!isContainerError || !demuxed.audioTrack) {
          throw error;
        }
        console.warn("[mux] Audio+video mux failed, retrying video-only output", error);
        return await muxWithMode(false);
      }
    },
    startStreamingMuxSession(demuxed, meta, abortSignal) {
      const output = new Output({
        format: new Mp4OutputFormat(),
        target: new BufferTarget()
      });
      const videoSource = new EncodedVideoPacketSource(
        toMediabunnyVideoCodec(demuxed.videoTrack.codec)
      );
      output.addVideoTrack(videoSource, { frameRate: meta.fps });
      let audioSource;
      if (demuxed.audioTrack) {
        audioSource = new EncodedAudioPacketSource(
          toMediabunnyAudioCodec(demuxed.audioTrack.codec)
        );
        output.addAudioTrack(audioSource);
      }
      let outputStarted = false;
      let startPromise = null;
      const ensureStarted = async () => {
        if (outputStarted) return;
        if (startPromise) return startPromise;
        startPromise = output.start().then(() => {
          outputStarted = true;
        });
        return startPromise;
      };
      let isFirstVideoPacket = true;
      let queue = Promise.resolve();
      let queueError;
      const enqueueVideoChunk = (chunk, decoderConfig) => {
        if (queueError) return;
        queue = queue.then(async () => {
          await ensureStarted();
          const packet = EncodedPacket.fromEncodedChunk(chunk);
          if (isFirstVideoPacket) {
            if (decoderConfig) {
              await videoSource.add(packet, { decoderConfig });
            } else {
              await videoSource.add(packet);
            }
            isFirstVideoPacket = false;
            return;
          }
          await videoSource.add(packet);
        }).catch((error) => {
          queueError = error;
          if (!abortSignal.aborted) {
            throw error;
          }
        });
      };
      const flushVideoQueue = async () => {
        await queue;
        if (queueError) {
          throw new ProcessingError(
            `Streaming mux failed while writing video packets: ${queueError instanceof Error ? queueError.message : String(queueError)}`
          );
        }
      };
      const finalize = async (audioSamples, audioDecoderConfig, onProgress) => {
        await flushVideoQueue();
        onProgress?.(40);
        if (audioSource && audioSamples.length) {
          await ensureStarted();
          let firstAudioPacket = true;
          let doneAudioPackets = 0;
          for (const sample of audioSamples) {
            const chunk = new EncodedAudioChunk({
              type: sample.is_rap ? "key" : "delta",
              timestamp: sample.cts,
              duration: sample.duration,
              data: new Uint8Array(sample.data)
            });
            const packet = EncodedPacket.fromEncodedChunk(chunk);
            if (firstAudioPacket) {
              await audioSource.add(packet, {
                decoderConfig: audioDecoderConfig
              });
              firstAudioPacket = false;
            } else {
              await audioSource.add(packet);
            }
            doneAudioPackets += 1;
            const audioProgress = 40 + Math.round(doneAudioPackets / audioSamples.length * 50);
            onProgress?.(Math.min(90, audioProgress));
          }
        }
        onProgress?.(95);
        await output.finalize();
        onProgress?.(100);
        const buffer = output.target.buffer;
        if (!buffer || buffer.byteLength === 0) {
          throw new ProcessingError("Mediabunny mux produced empty output");
        }
        return new Blob([buffer], { type: "video/mp4" });
      };
      return {
        enqueueVideoChunk,
        flushVideoQueue,
        finalize
      };
    }
  };
}

function createVideoCodecManager() {
  return {
    createDecoder(codec, description, onFrame, onError) {
      const decoder = new VideoDecoder({
        output: onFrame,
        error: (e) => {
          onError(`Video decoding error: ${e.message}`);
        }
      });
      const decoderConfig = { codec };
      if (description) decoderConfig.description = description;
      decoder.configure(decoderConfig);
      return decoder;
    },
    async isVideoTrackDecodable(codec, description) {
      try {
        const config = { codec };
        if (description) config.description = description;
        const support = await VideoDecoder.isConfigSupported(config);
        return support.supported === true;
      } catch {
        return false;
      }
    },
    async createEncoder(meta, sourceCodec, onChunk, onError) {
      const encoder = new VideoEncoder({
        output: onChunk,
        error: (e) => {
          onError(`Video encoding error: ${e.message}`);
        }
      });
      let encodeMeta = { ...meta };
      const configureWithCandidates = async (codecCandidates2, targetMeta) => {
        const targetBitrate = estimateTargetBitrate(meta, targetMeta, 0);
        const buildVariantConfigs = (codec) => {
          const common = {
            width: targetMeta.width,
            height: targetMeta.height,
            bitrate: targetBitrate,
            framerate: targetMeta.fps
          };
          return [
            {
              ...common,
              codec,
              hardwareAcceleration: "prefer-hardware"
            },
            {
              ...common,
              codec,
              hardwareAcceleration: "no-preference"
            },
            {
              ...common,
              codec,
              hardwareAcceleration: "prefer-software"
            }
          ];
        };
        for (const codec of codecCandidates2) {
          const variants = buildVariantConfigs(codec);
          for (const candidate of variants) {
            const support = await VideoEncoder.isConfigSupported(candidate);
            if (support.supported) {
              return candidate;
            }
          }
        }
        return void 0;
      };
      const codecCandidates = getCodecCandidates(meta, sourceCodec);
      let supportedConfig = await configureWithCandidates(codecCandidates, encodeMeta);
      if (!supportedConfig) {
        const fallbackMeta = scaleToMaxArea(meta, 2097152);
        encodeMeta = fallbackMeta;
        const fallbackCandidates = getCodecCandidates(encodeMeta, sourceCodec);
        supportedConfig = await configureWithCandidates(fallbackCandidates, encodeMeta);
      }
      if (!supportedConfig) {
        throw new ProcessingError("Unable to find a supported codec configuration for this resolution. Try reducing the video size.");
      }
      encoder.configure(supportedConfig);
      return { encoder, encodeMeta };
    }
  };
}

const CODEC_QUEUE_HIGH_WATERMARK = 24;
function isCodecQueuePressureHigh(decoder, encoder) {
  return decoder.decodeQueueSize > CODEC_QUEUE_HIGH_WATERMARK || encoder.encodeQueueSize > CODEC_QUEUE_HIGH_WATERMARK;
}
async function waitForCodecQueues(decoder, encoder, signal) {
  let spin = 0;
  while (!signal.aborted && isCodecQueuePressureHigh(decoder, encoder)) {
    if (spin % 2 === 0) {
      await Promise.resolve();
    } else {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    spin += 1;
  }
}

const STREAMING_MUX_FILE_SIZE_BYTES = 512 * 1024 * 1024;
const MAX_IN_FLIGHT_FRAME_TASKS = 3;
class VideoProcessor {
  abortController;
  options;
  demuxer = createDemuxer();
  muxer = createMuxer();
  codecManager = createVideoCodecManager();
  constructor(options) {
    this.options = options;
    this.abortController = new AbortController();
  }
  /**
   * Start processing the video.
   */
  async process() {
    if (typeof VideoDecoder === "undefined" || typeof VideoEncoder === "undefined") {
      throw new ProcessingError("WebCodecs API is not available in the current browser");
    }
    const { videoFile, videoMeta, telemetryFrames, syncOffsetSeconds, overlayConfig, onProgress } = this.options;
    const config = overlayConfig ?? DEFAULT_OVERLAY_CONFIG;
    const safeSyncOffsetSeconds = Number.isFinite(syncOffsetSeconds) ? syncOffsetSeconds : 0;
    onProgress?.({ phase: "demuxing", percent: 0, framesProcessed: 0, totalFrames: 0 });
    let sourceFile = videoFile;
    let demuxed = await this.demuxer.demuxWithFallback(sourceFile, onProgress);
    demuxed = await this.ensureDecodableTrack(demuxed, sourceFile, videoMeta, onProgress);
    demuxed = await this.ensureKeyframes(demuxed, sourceFile, videoMeta, onProgress);
    const videoSamples = this.sliceFromFirstKeyframe(demuxed.videoSamples);
    const totalFrames = videoSamples.length;
    const gopFrames = detectSourceGopSize(videoSamples, videoMeta.fps);
    const reportProcessingProgress = createProcessingProgressReporter(onProgress, totalFrames);
    const reportMuxProgress = createMuxProgressReporter(onProgress, totalFrames);
    onProgress?.({ phase: "processing", percent: 0, framesProcessed: 0, totalFrames });
    return await this.processFrames({
      demuxed,
      videoSamples,
      totalFrames,
      gopFrames,
      videoMeta,
      telemetryFrames,
      safeSyncOffsetSeconds,
      config,
      reportProcessingProgress,
      reportMuxProgress
    });
  }
  /**
   * Cancel the video processing.
   */
  cancel() {
    this.abortController.abort();
  }
  async ensureDecodableTrack(demuxed, sourceFile, videoMeta, onProgress) {
    const canDecode = await this.codecManager.isVideoTrackDecodable(
      demuxed.videoTrack.codec,
      demuxed.videoTrack.description
    );
    if (canDecode) return demuxed;
    onProgress?.({ phase: "encoding", percent: 0, framesProcessed: 0, totalFrames: 0 });
    const transcodedFile = await transcodeWithForcedKeyframes(
      sourceFile,
      { fps: videoMeta.fps, duration: videoMeta.duration },
      {
        gopSize: Math.max(1, Math.round(videoMeta.fps)),
        onProgress: (percent) => {
          onProgress?.({
            phase: "encoding",
            percent,
            framesProcessed: 0,
            totalFrames: 0
          });
        }
      }
    );
    const result = await this.demuxer.demuxWithFallback(transcodedFile, onProgress);
    const canDecodeTranscoded = await this.codecManager.isVideoTrackDecodable(
      result.videoTrack.codec,
      result.videoTrack.description
    );
    if (!canDecodeTranscoded) {
      throw new ProcessingError(
        `Browser does not support decoding codec ${result.videoTrack.codec} and automatic transcoding failed.`
      );
    }
    return result;
  }
  async ensureKeyframes(demuxed, sourceFile, videoMeta, onProgress) {
    const keyframeDetector = createKeyframeDetector(
      demuxed.videoTrack.codec,
      demuxed.videoTrack.description
    );
    let firstKeyframeIndex = demuxed.videoSamples.findIndex((sample) => sample.is_rap);
    if (firstKeyframeIndex === -1) {
      firstKeyframeIndex = demuxed.videoSamples.findIndex((sample) => keyframeDetector(sample));
    }
    if (firstKeyframeIndex !== -1) return demuxed;
    onProgress?.({ phase: "encoding", percent: 0, framesProcessed: 0, totalFrames: 0 });
    const transcodedFile = await transcodeWithForcedKeyframes(
      sourceFile,
      { fps: videoMeta.fps, duration: videoMeta.duration },
      {
        gopSize: Math.max(1, Math.round(videoMeta.fps)),
        onProgress: (percent) => {
          onProgress?.({
            phase: "encoding",
            percent,
            framesProcessed: 0,
            totalFrames: 0
          });
        }
      }
    );
    const result = await this.demuxer.demuxWithFallback(transcodedFile, onProgress);
    const newDetector = createKeyframeDetector(result.videoTrack.codec, result.videoTrack.description);
    const newFirstKeyframe = result.videoSamples.findIndex((sample) => newDetector(sample));
    if (newFirstKeyframe === -1) {
      throw new ProcessingError(
        "No IDR keyframes found in the video track. Automatic recovery failed and the file cannot be decoded."
      );
    }
    return result;
  }
  sliceFromFirstKeyframe(samples) {
    const keyframeDetector = createKeyframeDetector("unknown");
    let firstIndex = samples.findIndex((sample) => sample.is_rap);
    if (firstIndex === -1) {
      firstIndex = samples.findIndex((sample) => keyframeDetector(sample));
    }
    return firstIndex > 0 ? samples.slice(firstIndex) : samples;
  }
  async processFrames(params) {
    const {
      demuxed,
      videoSamples,
      totalFrames,
      gopFrames,
      videoMeta,
      telemetryFrames,
      safeSyncOffsetSeconds,
      config,
      reportProcessingProgress,
      reportMuxProgress
    } = params;
    const canvas = new OffscreenCanvas(videoMeta.width, videoMeta.height);
    const ctx = canvas.getContext("2d");
    if (typeof navigator !== "undefined" && "gpu" in navigator) {
      try {
        const { WebGPUAdapter } = await import('../main.mjs').then(n => n.w);
        if (WebGPUAdapter.isSupported()) {
          const adapter = WebGPUAdapter.getInstance();
          adapter.isEnabled();
        }
      } catch (error) {
        console.warn("[VideoProcessor] Failed to load WebGPU adapter:", error);
      }
    }
    const useStreamingMux = this.options.videoFile.size >= STREAMING_MUX_FILE_SIZE_BYTES;
    const encodedChunks = [];
    let encodedFrameCount = 0;
    let encoderDecoderConfig;
    let processingError;
    let streamingMuxSession;
    const recordError = (message) => {
      if (!processingError) {
        processingError = new ProcessingError(message);
        this.abortController.abort();
      }
    };
    const { encoder, encodeMeta } = await this.codecManager.createEncoder(
      videoMeta,
      demuxed.videoTrack.codec,
      (chunk, metadata) => {
        if (metadata?.decoderConfig) {
          encoderDecoderConfig = metadata.decoderConfig;
        }
        if (useStreamingMux && streamingMuxSession) {
          streamingMuxSession.enqueueVideoChunk(chunk, metadata?.decoderConfig ?? encoderDecoderConfig);
        } else {
          encodedChunks.push(chunk);
        }
      },
      recordError
    );
    if (useStreamingMux) {
      streamingMuxSession = this.muxer.startStreamingMuxSession(demuxed, encodeMeta, this.abortController.signal);
    }
    if (encodeMeta.width !== videoMeta.width || encodeMeta.height !== videoMeta.height) {
      canvas.width = encodeMeta.width;
      canvas.height = encodeMeta.height;
    }
    let frameProcessingQueue = Promise.resolve();
    let inFlightFrameTasks = 0;
    const decoder = this.codecManager.createDecoder(
      demuxed.videoTrack.codec,
      demuxed.videoTrack.description,
      (frame) => {
        inFlightFrameTasks += 1;
        frameProcessingQueue = frameProcessingQueue.then(async () => {
          if (this.abortController.signal.aborted) {
            frame.close();
            return;
          }
          await this.renderAndEncodeFrame({
            frame,
            canvas,
            ctx,
            videoMeta: encodeMeta,
            telemetryFrames,
            safeSyncOffsetSeconds,
            config,
            encoder,
            gopFrames,
            encodedFrameCount
          });
          encodedFrameCount += 1;
        }).finally(() => {
          inFlightFrameTasks = Math.max(0, inFlightFrameTasks - 1);
        }).catch((error) => {
          frame.close();
          recordError(error instanceof Error ? error.message : "Frame processing failed");
        });
      },
      recordError
    );
    let framesProcessed = 0;
    try {
      for (const sample of videoSamples) {
        if (this.abortController.signal.aborted) break;
        if (inFlightFrameTasks >= MAX_IN_FLIGHT_FRAME_TASKS) {
          await frameProcessingQueue;
        }
        const chunk = this.createVideoChunk(sample);
        decoder.decode(chunk);
        framesProcessed++;
        reportProcessingProgress.report(framesProcessed);
        if (isCodecQueuePressureHigh(decoder, encoder)) {
          await waitForCodecQueues(decoder, encoder, this.abortController.signal);
        }
      }
      reportProcessingProgress.report(framesProcessed, true);
      if (!this.abortController.signal.aborted && !processingError) {
        await decoder.flush();
        await frameProcessingQueue;
        await encoder.flush();
      }
    } finally {
      this.closeCodec(decoder, "VideoDecoder");
      this.closeCodec(encoder, "VideoEncoder");
    }
    if (processingError) throw processingError;
    if (this.abortController.signal.aborted) {
      throw new ProcessingError("Processing was cancelled by the user");
    }
    reportMuxProgress.report(0, framesProcessed);
    let blob = await this.finalizeOutput({
      useStreamingMux,
      streamingMuxSession,
      demuxed,
      encodedChunks,
      encoderDecoderConfig,
      encodeMeta,
      reportMuxProgress,
      framesProcessed
    });
    if (this.options.useFfmpegMux) {
      reportMuxProgress.report(99, framesProcessed);
      try {
        blob = await remuxWithFfmpeg(blob);
      } catch (error) {
        console.warn("[mux] FFmpeg remux failed, using Mediabunny output as-is", error);
      }
    }
    this.options.onProgress?.({ phase: "complete", percent: 100, framesProcessed, totalFrames });
    return blob;
  }
  async renderAndEncodeFrame(params) {
    const {
      frame,
      canvas,
      ctx,
      videoMeta,
      telemetryFrames,
      safeSyncOffsetSeconds,
      config,
      encoder,
      gopFrames,
      encodedFrameCount
    } = params;
    const videoTimeSec = (frame.timestamp ?? 0) / 1e6;
    const telemetry = getTelemetryAtTime(telemetryFrames, videoTimeSec, safeSyncOffsetSeconds);
    ctx.drawImage(frame, 0, 0, videoMeta.width, videoMeta.height);
    if (telemetry) {
      await renderOverlay(ctx, telemetry, videoMeta.width, videoMeta.height, config);
    }
    const newFrame = new VideoFrame(canvas, {
      timestamp: frame.timestamp,
      duration: frame.duration ?? void 0
    });
    frame.close();
    const forceKeyFrame = encodedFrameCount === 0 || gopFrames > 0 && encodedFrameCount % gopFrames === 0;
    if (forceKeyFrame) {
      encoder.encode(newFrame, { keyFrame: true });
    } else {
      encoder.encode(newFrame);
    }
    newFrame.close();
  }
  createVideoChunk(sample) {
    const timestampUs = sample.cts / sample.timescale * 1e6;
    const durationUs = sample.duration / sample.timescale * 1e6;
    return new EncodedVideoChunk({
      type: sample.is_rap ? "key" : "delta",
      timestamp: Math.round(timestampUs),
      duration: Math.round(durationUs),
      data: new Uint8Array(sample.data)
    });
  }
  closeCodec(codec, name) {
    if (codec.state !== "closed") {
      try {
        codec.close();
      } catch (error) {
        console.warn(`${name} close failed`, error);
      }
    }
  }
  async finalizeOutput(params) {
    const {
      useStreamingMux,
      streamingMuxSession,
      demuxed,
      encodedChunks,
      encoderDecoderConfig,
      encodeMeta,
      reportMuxProgress,
      framesProcessed
    } = params;
    if (useStreamingMux && streamingMuxSession) {
      await streamingMuxSession.flushVideoQueue();
      return streamingMuxSession.finalize(
        demuxed.audioSamples,
        demuxed.audioTrack?.decoderConfig ?? encoderDecoderConfig,
        (percent) => reportMuxProgress.report(percent, framesProcessed)
      );
    }
    return this.muxer.muxMp4(
      demuxed,
      encodedChunks,
      encoderDecoderConfig,
      encodeMeta,
      (percent) => reportMuxProgress.report(percent, framesProcessed)
    );
  }
}

const _sfc_main$1 = /* @__PURE__ */ defineComponent({
  __name: "ProgressBar",
  __ssrInlineRender: true,
  props: {
    progress: {},
    hasError: { type: Boolean }
  },
  setup(__props) {
    const props = __props;
    const percent = computed(() => props.progress.percent);
    const framesProcessed = computed(() => props.progress.framesProcessed);
    const totalFrames = computed(() => props.progress.totalFrames);
    const estimatedRemaining = computed(
      () => props.progress.estimatedRemainingSeconds
    );
    const isComplete = computed(() => props.progress.phase === "complete");
    const phaseLabel = computed(() => {
      switch (props.progress.phase) {
        case "demuxing":
          return "Preparing video...";
        case "processing":
          return "Processing frames...";
        case "encoding":
          return "Encoding...";
        case "muxing":
          return "Muxing video...";
        case "complete":
          return "Done!";
        default:
          return "Processing...";
      }
    });
    function formatRemaining(seconds) {
      if (!Number.isFinite(seconds) || seconds <= 0) return "";
      if (seconds < 60) return `${Math.round(seconds)} sec`;
      const minutes = Math.max(0, seconds / 60);
      return `${minutes.toFixed(1)} min`;
    }
    return (_ctx, _push, _parent, _attrs) => {
      _push(`<div${ssrRenderAttrs(mergeProps({
        class: "progress-bar",
        "data-testid": "progress-bar"
      }, _attrs))} data-v-24ffa660><div class="progress-bar__header" data-v-24ffa660><span class="progress-bar__phase" data-v-24ffa660>${ssrInterpolate(phaseLabel.value)}</span><span class="progress-bar__percent" data-v-24ffa660>${ssrInterpolate(percent.value)}%</span></div><div class="progress-bar__track" data-v-24ffa660><div style="${ssrRenderStyle({ width: `${percent.value}%` })}" class="${ssrRenderClass([{
        "progress-bar__fill--complete": isComplete.value,
        "progress-bar__fill--error": __props.hasError
      }, "progress-bar__fill"])}" data-v-24ffa660></div></div><div class="progress-bar__details" data-v-24ffa660>`);
      if (framesProcessed.value > 0) {
        _push(`<span data-v-24ffa660>${ssrInterpolate(framesProcessed.value)} / ${ssrInterpolate(totalFrames.value)} frames </span>`);
      } else {
        _push(`<!---->`);
      }
      if (estimatedRemaining.value) {
        _push(`<span data-v-24ffa660> ~${ssrInterpolate(formatRemaining(estimatedRemaining.value))} left </span>`);
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
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("src/components/ProgressBar.vue");
  return _sfc_setup$1 ? _sfc_setup$1(props, ctx) : void 0;
};
const ProgressBar = /* @__PURE__ */ _export_sfc(_sfc_main$1, [["__scopeId", "data-v-24ffa660"]]);

const _sfc_main = /* @__PURE__ */ defineComponent({
  __name: "ProcessingView",
  __ssrInlineRender: true,
  setup(__props) {
    useSeo({
      title: "Processing Video",
      description: "Your video is being processed with telemetry overlay. Browser-based encoding with WebGPU acceleration."
    });
    const router = useRouter();
    const filesStore = useFilesStore();
    const processingStore = useProcessingStore();
    const settingsStore = useSettingsStore();
    const syncStore = useSyncStore();
    const processorRef = ref(null);
    const isE2E = new URLSearchParams(window.location.search).has("e2e") || window.sessionStorage.getItem("e2e-mode") === "1";
    const hasStarted = ref(false);
    const webGPUStatus = ref(null);
    function checkWebGPUStatus() {
      webGPUStatus.value = getWebGPUStatus();
    }
    async function startProcessingFlow() {
      if (hasStarted.value || !filesStore.isReady) return;
      hasStarted.value = true;
      const videoMeta = filesStore.videoMeta;
      const totalFrames = Math.ceil(videoMeta.duration * videoMeta.fps);
      processingStore.startProcessing(totalFrames);
      try {
        if (isE2E) {
          await simulateProcessing(totalFrames);
          processingStore.setResult(new Blob([], { type: "video/mp4" }));
          return;
        }
        const telemetryFrames = buildTelemetryTimeline(filesStore.gpxData.points);
        const safeSyncOffset = Number.isFinite(syncStore.offsetSeconds) ? syncStore.offsetSeconds : 0;
        const processor = new VideoProcessor({
          videoFile: filesStore.videoFile,
          videoMeta,
          telemetryFrames,
          syncOffsetSeconds: safeSyncOffset,
          overlayConfig: settingsStore.overlayConfig,
          onProgress: (progress) => processingStore.updateProgress(progress),
          useFfmpegMux: typeof SharedArrayBuffer !== "undefined"
        });
        processorRef.value = processor;
        const result = await processor.process();
        processingStore.setResult(result);
      } catch (err) {
        processingStore.setError(normalizeProcessingError(err));
      }
    }
    onMounted(() => {
      checkWebGPUStatus();
      if (!filesStore.isReady && !isE2E) {
        router.push("/");
        return;
      }
      if (filesStore.isReady) {
        void startProcessingFlow();
      }
    });
    watch(
      () => filesStore.isReady,
      (ready) => {
        if (ready) {
          void startProcessingFlow();
        }
      }
    );
    async function simulateProcessing(totalFrames) {
      const steps = 20;
      const delayMs = 100;
      for (let step = 1; step <= steps; step += 1) {
        if (!processingStore.isProcessing) break;
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        const framesProcessed = Math.min(
          Math.round(step / steps * totalFrames),
          totalFrames
        );
        processingStore.updateProgress({
          phase: "processing",
          percent: Math.min(99, Math.round(step / steps * 100)),
          framesProcessed,
          totalFrames
        });
      }
    }
    function goToResult() {
      settingsStore.setScreen("result");
      router.push("/result");
    }
    watch(
      () => processingStore.isComplete,
      (complete) => {
        if (complete && !isE2E) {
          setTimeout(() => {
            goToResult();
          }, 1500);
        }
      }
    );
    return (_ctx, _push, _parent, _attrs) => {
      _push(`<div${ssrRenderAttrs(mergeProps({ class: "processing-view" }, _attrs))} data-v-64221f36><header class="processing-view__header" data-v-64221f36><h2 data-v-64221f36>Video processing</h2><p class="processing-view__subtitle" data-v-64221f36> Please do not close this tab until processing is complete </p></header>`);
      if (webGPUStatus.value) {
        _push(`<div class="processing-view__webgpu-status" data-v-64221f36><div class="${ssrRenderClass([{
          "webgpu-badge--active": webGPUStatus.value.enabled && webGPUStatus.value.supported
        }, "webgpu-badge"])}" data-v-64221f36><span class="webgpu-badge__icon" data-v-64221f36>${ssrInterpolate(webGPUStatus.value.enabled && webGPUStatus.value.supported ? "⚡" : "🐢")}</span><span class="webgpu-badge__text" data-v-64221f36>${ssrInterpolate(webGPUStatus.value.enabled && webGPUStatus.value.supported ? "GPU Acceleration" : "CPU Mode")}</span>`);
        if (webGPUStatus.value.supported) {
          _push(`<span class="webgpu-badge__toggle" data-v-64221f36>${ssrInterpolate(webGPUStatus.value.enabled ? "Disable" : "Enable")}</span>`);
        } else {
          _push(`<!---->`);
        }
        _push(`</div></div>`);
      } else {
        _push(`<!---->`);
      }
      _push(ssrRenderComponent(ProgressBar, {
        progress: unref(processingStore).progress,
        "has-error": !!unref(processingStore).processingError
      }, null, _parent));
      if (unref(processingStore).processingError) {
        _push(`<div class="processing-view__error" data-testid="processing-error" data-v-64221f36><p data-v-64221f36>❌ ${ssrInterpolate(unref(processingStore).processingError)}</p>`);
        if (unref(processingStore).processingError && (unref(processingStore).processingError.includes("ffmpeg core") || unref(processingStore).processingError.includes("ffmpeg-core.js"))) {
          _push(`<div class="processing-view__hint" data-v-64221f36><p data-v-64221f36><strong data-v-64221f36>Hint:</strong> The browser failed to load the FFmpeg core JS/WASM. This is usually a network/CORS issue or missing local core files. </p><p data-v-64221f36>Fix options:</p><ol data-v-64221f36><li data-v-64221f36> Run <code data-v-64221f36>bun run fetch-ffmpeg-core</code> in the <code data-v-64221f36>frontend</code> folder to download core files to <code data-v-64221f36>public/vendor/ffmpeg</code>, then reload the page. </li><li data-v-64221f36> Or ensure your network/CORS settings allow fetching from the CDN (check devtools Network tab for the requests to <code data-v-64221f36>@ffmpeg/core</code>). </li></ol></div>`);
        } else {
          _push(`<!---->`);
        }
        _push(`<button class="processing-view__btn" data-v-64221f36>← Back</button></div>`);
      } else {
        _push(`<!---->`);
      }
      if (unref(processingStore).isProcessing) {
        _push(`<div class="processing-view__actions" data-v-64221f36><button class="processing-view__btn processing-view__btn--cancel" data-testid="cancel-btn" data-v-64221f36> Cancel </button></div>`);
      } else {
        _push(`<!---->`);
      }
      if (unref(processingStore).isComplete) {
        _push(`<div class="processing-view__complete" data-testid="processing-complete" data-v-64221f36><p data-v-64221f36>✅ Processing complete!</p><button class="processing-view__btn processing-view__btn--primary" data-v-64221f36> Go to result → </button></div>`);
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
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("src/views/ProcessingView.vue");
  return _sfc_setup ? _sfc_setup(props, ctx) : void 0;
};
const ProcessingView = /* @__PURE__ */ _export_sfc(_sfc_main, [["__scopeId", "data-v-64221f36"]]);

export { ProcessingView as default };
