import mediumUrl from '../assets/fonts/BarlowSemiCondensed-Medium.woff2?url';
import semiboldUrl from '../assets/fonts/BarlowSemiCondensed-SemiBold.woff2?url';

export const TRAIL_RUN_FONT_FAMILY = '"Barlow Semi Condensed", sans-serif';

let loading: Promise<void> | undefined;

/** Await the same bundled faces before preview or export measures any text. */
export function ensureTrailRunFonts(): Promise<void> {
    if (typeof FontFace === 'undefined' || typeof document === 'undefined' || !document.fonts) {
        return Promise.resolve();
    }
    loading ??= Promise.all([
        new FontFace('Barlow Semi Condensed', `url("${mediumUrl}")`, { weight: '500', featureSettings: '"tnum"' }).load(),
        new FontFace('Barlow Semi Condensed', `url("${semiboldUrl}")`, { weight: '600', featureSettings: '"tnum"' }).load(),
    ]).then(faces => {
        for (const face of faces) document.fonts.add(face);
    }).catch(error => {
        loading = undefined;
        throw error;
    });
    return loading;
}
