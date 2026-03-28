import { defineStore } from 'pinia';
import { onBeforeMount, ref, watch } from 'vue';
import SESSION from '../util/session';

export default defineStore('useRightSideStore', () => {
    const keyStorage = 'storageRightSideSplitPaneSizes';
    const showBottomPane = ref(false);
    const showRightPanel = ref(true);
    const lastSelectedBottomMenu = ref<string | null>(null);
    const rightSidePaneSplitStartUpValue = ref<Array<{ min: number; max: number; size: number }>>([
        { min: 20, max: 80, size: 50 },
        { min: 20, max: 80, size: 50 },
    ]);

    function resizingPaneRightSide(sizes: Array<any>) {
        if (sizes[1].size === 0 || sizes[0].size === 100) {
            return;
        }

        rightSidePaneSplitStartUpValue.value = sizes;
        SESSION.set(keyStorage, sizes);
    }

    onBeforeMount(() => {
        const value = SESSION.get(keyStorage);
        showBottomPane.value = SESSION.get('showRightSideBottomPane') ?? false;
        showRightPanel.value = SESSION.get('showRightPanel') ?? true;
        lastSelectedBottomMenu.value = SESSION.get('lastSelectedBottomMenu') ?? null;
        if (value) rightSidePaneSplitStartUpValue.value = value;
    });

    watch(
        () => [showBottomPane.value, showRightPanel.value, lastSelectedBottomMenu.value],
        ([showBottom, showRightPanelValue, lastSelected]) => {
            SESSION.set('showRightSideBottomPane', showBottom);
            SESSION.set('showRightPanel', showRightPanelValue);
            SESSION.set('lastSelectedBottomMenu', lastSelected);
        }
    );

    return {
        lastSelectedBottomMenu,
        showBottomPane,
        showRightPanel,
        resizingPaneRightSide,
        rightSidePaneSplitStartUpValue,
    };
});
