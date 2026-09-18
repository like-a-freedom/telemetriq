// Keep these as URL expressions instead of static `?url` imports. The browser
// build still turns them into hashed asset URLs, while Playwright's Node-side
// E2E loader can import the template registry without trying to parse WOFF2.
const mediumUrl = new URL('../assets/fonts/BarlowSemiCondensed-Medium.woff2', import.meta.url).href;
const semiboldUrl = new URL('../assets/fonts/BarlowSemiCondensed-SemiBold.woff2', import.meta.url).href;

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
