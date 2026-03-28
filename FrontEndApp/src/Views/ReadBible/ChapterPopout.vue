<script setup lang="ts">
import { computed, nextTick, onBeforeMount, onMounted, onBeforeUnmount, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { NEmpty, NIcon, NInput, NSelect, NSpin, NSwitch } from 'naive-ui';
import SESSION from '../../util/session';
import { bibleBooks } from '../../util/books';
import { filterBibleVerseText, isEsvVersion } from '../../util/filterBibleVerseText';
import { useThemeStore } from '../../store/theme';
import { useSettingStore } from '../../store/settingStore';
import { Search24Regular } from '@vicons/fluent';
import type { searchBibleType } from '../../GlobalTypes';

const route = useRoute();
const themeStore = useThemeStore();
const settingStore = useSettingStore();
const verses = ref<Array<any>>([]);
const fontSize = ref(15);
const fontSelected = ref('Poppins');
const isDraggingHandle = ref(false);
const dragStart = ref<null | { pointerScreenX: number; pointerScreenY: number; windowX: number; windowY: number }>(null);
const currentBookNumber = ref(Number(route.query.bookNumber || 10));
const currentChapter = ref(Number(route.query.chapter || 1));
const isTopBarOpen = ref(false);
const searchQuery = ref('');
const searchResults = ref<searchBibleType>([]);
const isSearching = ref(false);
const topBarCloseTimeout = ref<ReturnType<typeof setTimeout> | null>(null);
const searchDebounceTimeout = ref<ReturnType<typeof setTimeout> | null>(null);

const versions = computed<string[]>(() => {
    const raw = route.query.versions;
    if (typeof raw !== 'string') return [];

    try {
        return JSON.parse(decodeURIComponent(raw));
    } catch (error) {
        return [];
    }
});

const selectedBook = computed(() => {
    const book = bibleBooks.find((item) => item.book_number === currentBookNumber.value);
    return book || bibleBooks[0];
});

const bookOptions = computed(() =>
    bibleBooks.map((book) => ({
        label: book.title,
        value: book.book_number,
    }))
);

const chapterOptions = computed(() =>
    Array.from({ length: selectedBook.value.chapter_count }, (_, index) => ({
        label: String(index + 1),
        value: index + 1,
    }))
);
const hasEsvSelectedVersion = computed(() =>
    versions.value.some((version) => isEsvVersion(version))
);

const versionColumns = computed(() => {
    if (!verses.value.length) return [];

    return verses.value[0].version.map((version: any, versionIndex: number) => ({
        versionIndex,
        key: version.key,
        label: version.version.replace('.SQLite3', ''),
    }));
});

const popoutThemeStyle = computed(() => ({
    backgroundColor:
        themeStore.backgroundTheme === 'default'
            ? themeStore.isDark
                ? '#18181c'
                : '#ffffff'
            : 'var(--theme-bg-main)',
    color:
        themeStore.backgroundTheme === 'default'
            ? themeStore.isDark
                ? '#f5f5f5'
                : '#111827'
            : 'var(--theme-text)',
    '--scrollbar-track':
        themeStore.backgroundTheme === 'default'
            ? themeStore.isDark
                ? 'rgba(255,255,255,0.08)'
                : 'rgba(0,0,0,0.06)'
            : 'var(--theme-bg-soft)',
    '--scrollbar-thumb':
        themeStore.backgroundTheme === 'default'
            ? themeStore.isDark
                ? 'rgba(255,255,255,0.26)'
                : 'rgba(0,0,0,0.28)'
            : 'var(--theme-text-soft)',
    '--scrollbar-thumb-hover': 'var(--primary-color)',
    '--drag-pill-bg':
        themeStore.backgroundTheme === 'default'
            ? themeStore.isDark
                ? 'rgba(255,255,255,0.12)'
                : 'rgba(17,24,39,0.10)'
            : 'var(--theme-text-soft)',
    '--drag-pill-border':
        themeStore.backgroundTheme === 'default'
            ? themeStore.isDark
                ? 'rgba(255,255,255,0.18)'
                : 'rgba(17,24,39,0.14)'
            : 'var(--theme-border)',
}));

function applyWindowSurfaceStyle() {
    document.documentElement.style.backgroundColor = `${popoutThemeStyle.value.backgroundColor}`;
    document.documentElement.style.color = `${popoutThemeStyle.value.color}`;
    document.body.style.backgroundColor = `${popoutThemeStyle.value.backgroundColor}`;
    document.body.style.color = `${popoutThemeStyle.value.color}`;
}

function getVerseVersion(verse: any, versionIndex: number) {
    return verse.version[versionIndex];
}

function updatePopoutUrl() {
    const query = new URLSearchParams({
        bookNumber: String(currentBookNumber.value),
        chapter: String(currentChapter.value),
        title: `${selectedBook.value.title} ${currentChapter.value}`,
        versions: encodeURIComponent(JSON.stringify(versions.value)),
    });

    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#/chapter-popout?${query.toString()}`);
}

async function scrollToVerse(verseNumber: number | null) {
    if (!verseNumber) return;

    await nextTick();
    document.getElementById(`chapter-popout-verse-${verseNumber}`)?.scrollIntoView({
        block: 'center',
        behavior: 'smooth',
    });
}

async function loadChapter(verseToScroll: number | null = null) {
    const payload = {
        bible_versions: versions.value,
        book_number: currentBookNumber.value,
        selected_chapter: currentChapter.value,
    };

    const data = await window.browserWindow.getVerses(JSON.stringify(payload));
    verses.value = data.map((verse: any) => ({
        ...verse,
        version: verse.version.map((version: any) => ({
            ...version,
            key: `${version.version.replace('.SQLite3', '')}_${verse.book_number}_${verse.chapter}_${verse.verse}`,
            text: filterBibleVerseText(
                version.text,
                settingStore.filterEsvMarkers && isEsvVersion(version.version)
            ),
        })),
    }));

    document.title = `${selectedBook.value.title} ${currentChapter.value}`;
    updatePopoutUrl();
    await scrollToVerse(verseToScroll);
}

function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
        window.browserWindow.closeWindow();
    }
}

async function startHandleDrag(event: PointerEvent) {
    if (event.button !== 0) return;

    const bounds = await window.browserWindow.getWindowBounds();
    dragStart.value = {
        pointerScreenX: event.screenX,
        pointerScreenY: event.screenY,
        windowX: bounds.x,
        windowY: bounds.y,
    };
    isDraggingHandle.value = true;
}

async function handlePointerMove(event: PointerEvent) {
    if (!dragStart.value || !isDraggingHandle.value) return;

    const nextX = dragStart.value.windowX + (event.screenX - dragStart.value.pointerScreenX);
    const nextY = dragStart.value.windowY + (event.screenY - dragStart.value.pointerScreenY);

    await window.browserWindow.setWindowPosition(nextX, nextY);
}

function stopHandleDrag() {
    isDraggingHandle.value = false;
    dragStart.value = null;
}

function openTopBar() {
    if (topBarCloseTimeout.value) clearTimeout(topBarCloseTimeout.value);
    isTopBarOpen.value = true;
}

function scheduleTopBarClose() {
    if (topBarCloseTimeout.value) clearTimeout(topBarCloseTimeout.value);
    topBarCloseTimeout.value = setTimeout(() => {
        isTopBarOpen.value = false;
    }, 160);
}

async function selectBook(bookNumber: number) {
    if (bookNumber === currentBookNumber.value) return;

    currentBookNumber.value = bookNumber;
    currentChapter.value = Math.min(currentChapter.value, selectedBook.value.chapter_count);
    await loadChapter();
}

async function selectChapter(chapterNumber: number) {
    if (chapterNumber === currentChapter.value) return;

    currentChapter.value = chapterNumber;
    await loadChapter();
}

async function jumpToVerse(bookNumber: number, chapterNumber: number, verseNumber: number) {
    currentBookNumber.value = bookNumber;
    currentChapter.value = chapterNumber;
    await loadChapter(verseNumber);
    searchQuery.value = '';
    searchResults.value = [];
    isTopBarOpen.value = false;
}

async function runSearch() {
    const trimmedQuery = searchQuery.value.trim();
    if (!trimmedQuery) {
        searchResults.value = [];
        isSearching.value = false;
        return;
    }

    isSearching.value = true;

    try {
        const payload = {
            search: trimmedQuery,
            bible_versions: versions.value,
            page: 1,
            limit: 8,
            book_numbers: bibleBooks.map((book) => book.book_number),
        };

        const result = await window.browserWindow.searchBible(JSON.stringify(payload));
        searchResults.value = result.map((verse) => ({
            ...verse,
            version: verse.version.map((version) => ({
                ...version,
                text: filterBibleVerseText(
                    version.text,
                    settingStore.filterEsvMarkers && isEsvVersion(version.version)
                ),
            })),
        }));
    } finally {
        isSearching.value = false;
    }
}

watch(
    () => fontSelected.value,
    (selectedFont: string) => {
        document.documentElement.style.setProperty('--bible-font-family', selectedFont);
    }
);

watch(
    () => [themeStore.isDark, themeStore.backgroundTheme],
    () => {
        applyWindowSurfaceStyle();
    },
    { immediate: true }
);

watch(
    () => searchQuery.value,
    (value) => {
        if (searchDebounceTimeout.value) clearTimeout(searchDebounceTimeout.value);

        if (!value.trim()) {
            searchResults.value = [];
            isSearching.value = false;
            return;
        }

        searchDebounceTimeout.value = setTimeout(() => {
            runSearch();
        }, 260);
    }
);

watch(
    () => settingStore.filterEsvMarkers,
    async () => {
        await loadChapter();

        if (searchQuery.value.trim()) {
            await runSearch();
        }
    }
);

onBeforeMount(async () => {
    const savedFontSize = SESSION.get('font-size-of-show-chapter');
    if (savedFontSize) fontSize.value = savedFontSize;

    const savedFontFamily = SESSION.get('font-family-of-show-chapter');
    if (savedFontFamily) fontSelected.value = savedFontFamily;
    document.documentElement.style.setProperty('--bible-font-family', fontSelected.value);

    await loadChapter();
});

onMounted(() => {
    applyWindowSurfaceStyle();
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', stopHandleDrag);
    window.addEventListener('pointercancel', stopHandleDrag);
});

onBeforeUnmount(() => {
    window.removeEventListener('keydown', handleKeyDown);
    window.removeEventListener('pointermove', handlePointerMove);
    window.removeEventListener('pointerup', stopHandleDrag);
    window.removeEventListener('pointercancel', stopHandleDrag);
    if (topBarCloseTimeout.value) clearTimeout(topBarCloseTimeout.value);
    if (searchDebounceTimeout.value) clearTimeout(searchDebounceTimeout.value);
    document.documentElement.style.backgroundColor = '';
    document.documentElement.style.color = '';
    document.body.style.backgroundColor = '';
    document.body.style.color = '';
});
</script>

<template>
    <div
        class="chapter-popout-root show-chapter-verses read-bible-verses-panel overflowing-div"
        :class="{ dark: themeStore.isDark, 'chapter-popout-dragging': isDraggingHandle }"
        :style="popoutThemeStyle"
    >
        <div
            class="chapter-popout-topbar"
            :class="{ 'chapter-popout-topbar-open': isTopBarOpen }"
            @focusin="openTopBar"
            @focusout="scheduleTopBarClose"
        >
            <div
                class="chapter-popout-topbar-hitbox"
                aria-hidden="true"
                @pointerenter="openTopBar"
                @pointerleave="scheduleTopBarClose"
            ></div>
            <button
                type="button"
                class="chapter-popout-drag-pill"
                @pointerenter="openTopBar"
                @pointerleave="scheduleTopBarClose"
                @pointerdown.prevent="startHandleDrag"
            ></button>
            <div
                class="chapter-popout-toolbar"
                @pointerenter="openTopBar"
                @pointerleave="scheduleTopBarClose"
            >
                <div class="chapter-popout-toolbar-row">
                    <NSelect
                        :value="currentBookNumber"
                        :options="bookOptions"
                        size="small"
                        class="chapter-popout-select chapter-popout-book-select"
                        @update:value="selectBook"
                    />
                    <NSelect
                        :value="currentChapter"
                        :options="chapterOptions"
                        size="small"
                        class="chapter-popout-select chapter-popout-chapter-select"
                        @update:value="selectChapter"
                    />
                    <div
                        v-if="hasEsvSelectedVersion"
                        class="chapter-popout-toolbar-toggle"
                    >
                        <NSwitch v-model:value="settingStore.filterEsvMarkers" size="small" />
                        <span>{{ $t('filter-esv-markers') }}</span>
                    </div>
                    <div class="chapter-popout-search-wrap">
                        <NInput
                            v-model:value="searchQuery"
                            clearable
                            size="small"
                            placeholder="Search Bible..."
                            class="chapter-popout-search-input"
                        >
                            <template #prefix>
                                <NIcon :component="Search24Regular" />
                            </template>
                        </NInput>
                        <div
                            v-if="searchQuery.trim()"
                            class="chapter-popout-search-results overflowing-div"
                        >
                            <div v-if="isSearching" class="chapter-popout-search-state">
                                <NSpin size="small" />
                            </div>
                            <div
                                v-else-if="!searchResults.length"
                                class="chapter-popout-search-state"
                            >
                                <NEmpty description="No matches" size="small" />
                            </div>
                            <button
                                v-for="result in searchResults"
                                :key="`${result.book_number}-${result.chapter}-${result.verse}`"
                                type="button"
                                class="chapter-popout-search-result"
                                @click="
                                    jumpToVerse(
                                        result.book_number,
                                        result.chapter,
                                        result.verse
                                    )
                                "
                            >
                                <div class="chapter-popout-search-ref">
                                    {{ bibleBooks.find((book) => book.book_number === result.book_number)?.short_name }}
                                    {{ result.chapter }}:{{ result.verse }}
                                </div>
                                <div
                                    class="chapter-popout-search-snippet"
                                    v-html="result.version[0]?.text || ''"
                                ></div>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <div class="chapter-popout-content">
            <div v-if="versionColumns.length <= 3" class="chapter-popout-grid">
                <div
                    v-for="column in versionColumns"
                    :key="column.key"
                    class="chapter-popout-column"
                >
                    <div v-if="versionColumns.length > 1" class="chapter-popout-version">
                        {{ column.label }}
                    </div>
                    <div
                        v-for="verse in verses"
                        :key="`${column.key}-${verse.verse}`"
                        :id="`chapter-popout-verse-${verse.verse}`"
                        class="chapter-popout-verse"
                        :style="`font-size:${fontSize}px`"
                    >
                        <span class="chapter-popout-verse-number">{{ verse.verse }}.</span>
                        <span
                            class="verse-select-text chapter-popout-text"
                            v-html="getVerseVersion(verse, column.versionIndex).text"
                        ></span>
                    </div>
                </div>
            </div>

            <div v-else class="chapter-popout-stack">
                <div
                    v-for="column in versionColumns"
                    :key="column.key"
                    class="chapter-popout-section"
                >
                    <div class="chapter-popout-version">{{ column.label }}</div>
                    <div
                        v-for="verse in verses"
                        :key="`${column.key}-${verse.verse}`"
                        :id="`chapter-popout-verse-${verse.verse}`"
                        class="chapter-popout-verse"
                        :style="`font-size:${fontSize}px`"
                    >
                        <span class="chapter-popout-verse-number">{{ verse.verse }}.</span>
                        <span
                            class="verse-select-text chapter-popout-text"
                            v-html="getVerseVersion(verse, column.versionIndex).text"
                        ></span>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped lang="scss" src="./ViewVerses/ViewVersesStyle.scss"></style>
<style scoped lang="scss">
.chapter-popout-root {
    min-height: 100vh;
    height: 100vh;
    overflow-y: auto;
    overflow-x: hidden;
    position: relative;
    box-sizing: border-box;
}

.chapter-popout-content {
    padding: 10px 24px 28px;
    box-sizing: border-box;
    width: 100%;
}

.chapter-popout-grid {
    width: min(1200px, 66%);
    margin: 0 auto;
    display: grid;
    gap: 24px;
    grid-template-columns: repeat(auto-fit, minmax(0, 1fr));
    box-sizing: border-box;
}

.chapter-popout-stack {
    width: min(1200px, 66%);
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 28px;
    box-sizing: border-box;
}

.chapter-popout-column,
.chapter-popout-section {
    min-width: 0;
}

.chapter-popout-version {
    font-weight: 700;
    color: var(--primary-color);
    margin-bottom: 12px;
    user-select: none;
}

.chapter-popout-verse {
    display: block;
    line-height: 1.85;
    padding: 5px 12px;
}

.chapter-popout-verse-number {
    font-weight: 700;
    font-style: italic;
    margin-right: 6px;
    user-select: none;
}

.chapter-popout-text {
    display: inline;
}

.chapter-popout-root :deep(.verse-select-text) {
    color: inherit;
}

.chapter-popout-topbar {
    position: fixed;
    top: 8px;
    left: 50%;
    z-index: 30;
    width: min(1200px, 66%);
    max-width: calc(100vw - 48px);
    margin: 0;
    transform: translateX(-50%);
    display: flex;
    flex-direction: column;
    align-items: center;
    pointer-events: none;
}

.chapter-popout-topbar-hitbox {
    position: absolute;
    top: -6px;
    left: 50%;
    width: 180px;
    height: 20px;
    transform: translateX(-50%);
    pointer-events: auto;
}

.chapter-popout-toolbar {
    width: 100%;
    max-width: 100%;
    pointer-events: none;
    opacity: 0;
    transform: translateY(-14px);
    transition: opacity 0.18s ease, transform 0.18s ease;
    margin-top: 8px;
}

.chapter-popout-topbar-open .chapter-popout-toolbar {
    pointer-events: auto;
    opacity: 1;
    transform: translateY(0);
}

.chapter-popout-toolbar-row {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    border-radius: 14px;
    background: color-mix(in srgb, var(--theme-bg-elevated, rgba(24,24,28,0.92)) 92%, transparent);
    border: 1px solid var(--theme-border, rgba(255,255,255,0.08));
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.18);
    backdrop-filter: blur(12px);
    box-sizing: border-box;
}

.chapter-popout-select {
    flex: 0 0 auto;
}

.chapter-popout-book-select {
    width: 180px;
}

.chapter-popout-chapter-select {
    width: 96px;
}

.chapter-popout-search-wrap {
    position: relative;
    flex: 1 1 auto;
    min-width: 0;
}

.chapter-popout-toolbar-toggle {
    display: flex;
    align-items: center;
    gap: 8px;
    white-space: nowrap;
    font-size: 12px;
}

.chapter-popout-search-input {
    width: 100%;
}

.chapter-popout-search-results {
    position: absolute;
    top: calc(100% + 8px);
    left: 0;
    right: 0;
    max-height: 320px;
    overflow-y: auto;
    padding: 6px;
    border-radius: 14px;
    background: var(--theme-bg-elevated, rgba(24, 24, 28, 0.96));
    border: 1px solid var(--theme-border, rgba(255,255,255,0.08));
    box-shadow: 0 16px 34px rgba(0, 0, 0, 0.22);
    box-sizing: border-box;
}

.chapter-popout-search-result {
    width: 100%;
    display: block;
    text-align: left;
    padding: 10px 12px;
    border: 0;
    border-radius: 10px;
    background: transparent;
    color: inherit;
    cursor: pointer;
    transition: background-color 0.15s ease;
}

.chapter-popout-search-result:hover,
.chapter-popout-search-result:focus-visible {
    background: var(--theme-bg-soft, rgba(255,255,255,0.06));
    outline: none;
}

.chapter-popout-search-ref {
    font-size: 12px;
    font-weight: 700;
    color: var(--primary-color);
    margin-bottom: 4px;
}

.chapter-popout-search-snippet {
    line-height: 1.45;
    opacity: 0.9;
}

.chapter-popout-search-snippet :deep(mark) {
    background: rgba(242, 173, 35, 0.22);
}

.chapter-popout-search-state {
    min-height: 100px;
    display: flex;
    align-items: center;
    justify-content: center;
}

.chapter-popout-drag-pill {
    width: 72px;
    height: 5px;
    border-radius: 999px;
    background: var(--drag-pill-bg);
    border: 1px solid var(--drag-pill-border);
    box-sizing: border-box;
    padding: 0;
    appearance: none;
    cursor: grab;
    opacity: 0.42;
    transition: opacity 0.18s ease, transform 0.18s ease;
    pointer-events: auto;
}

.chapter-popout-drag-pill:hover {
    opacity: 1;
    transform: translateY(1px);
}

.chapter-popout-dragging,
.chapter-popout-dragging .chapter-popout-drag-pill {
    cursor: grabbing;
}

.chapter-popout-root :deep(j) {
    color: rgb(252, 84, 84);
}

.chapter-popout-root.dark :deep(j) {
    color: rgb(253, 155, 155);
}

@media (max-width: 1200px) {
    .chapter-popout-content,
    .chapter-popout-root {
        padding-left: 0;
        padding-right: 0;
    }

    .chapter-popout-content {
        padding-top: 10px;
        padding-bottom: 28px;
    }

    .chapter-popout-topbar,
    .chapter-popout-grid,
    .chapter-popout-stack {
        width: 100%;
        max-width: 100%;
    }

    .chapter-popout-toolbar-row {
        flex-wrap: wrap;
    }

    .chapter-popout-book-select,
    .chapter-popout-chapter-select,
    .chapter-popout-toolbar-toggle,
    .chapter-popout-search-wrap {
        width: 100%;
    }

    .chapter-popout-toolbar-toggle {
        justify-content: space-between;
    }
}
</style>
