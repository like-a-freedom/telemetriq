export {
    validateVideoFile,
    extractVideoMeta,
    extractMp4Metadata,
    isWebCodecsSupported,
    isSharedArrayBufferSupported,
    checkBrowserCapabilities,
    parseDjiFilename,
    findMetadataDate,
    findDateInUnknown,
    toValidDate,
    findIso6709Location,
    extractMp4CreationTimeFromMvhd,
    MAX_VIDEO_SIZE,
    MAX_VIDEO_DURATION_SECONDS,
    WARN_DURATION_SECONDS,
    FAST_METADATA_THRESHOLD_BYTES,
} from './validation/index';

export type { FileValidation, VideoMeta } from '../core/types';
export { ValidationError } from '../core/errors';