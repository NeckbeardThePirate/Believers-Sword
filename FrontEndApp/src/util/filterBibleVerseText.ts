const BRACKETED_NUMBER_PATTERN = /\[\d+\]/g;
const ENCLOSED_ALPHANUMERIC_PATTERN = /[\u2460-\u24FF]/g;
const ESV_VERSION_PATTERN = /English Standard Version/i;

export function isEsvVersion(versionName: string | null | undefined) {
    return Boolean(versionName && ESV_VERSION_PATTERN.test(versionName));
}

export function filterBibleVerseText(text: string | null | undefined, enabled = true) {
    if (!text) return '';
    if (!enabled) return text;

    return text
        .replace(BRACKETED_NUMBER_PATTERN, '')
        .replace(ENCLOSED_ALPHANUMERIC_PATTERN, '')
        .replace(/\s{2,}/g, ' ')
        .trim();
}
