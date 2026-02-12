import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { SyncConfig, TrackPoint } from '../core/types';
import { autoSync, clampSyncOffset } from '../modules/sync-engine';

export const useSyncStore = defineStore('sync', () => {
    // State
    const syncConfig = ref<SyncConfig>({
        offsetSeconds: 0,
        autoSynced: false,
    });
    const isAutoSyncing = ref(false);
    const syncError = ref<string | null>(null);
    const syncWarning = ref<string | null>(null);
    const manualOverrideActive = ref(false);

    // Computed
    const offsetSeconds = computed(() => syncConfig.value.offsetSeconds);
    const isAutoSynced = computed(() => syncConfig.value.autoSynced);

    // Actions
    function setManualOffset(seconds: number): void {
        const safeSeconds = Number.isFinite(seconds) ? seconds : 0;
        syncConfig.value = {
            offsetSeconds: clampSyncOffset(safeSeconds),
            autoSynced: false,
        };
        manualOverrideActive.value = true;
        syncError.value = null;
    }

    async function performAutoSync(
        gpxPoints: TrackPoint[],
        videoStartTime?: Date,
        videoStartLat?: number,
        videoStartLon?: number,
        videoTimezoneOffsetMinutes?: number,
        allowOverrideManual = false,
    ): Promise<void> {
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
                videoTimezoneOffsetMinutes,
            );
            syncConfig.value = result;
            manualOverrideActive.value = false;

            if (result.warning) {
                syncWarning.value = result.warning;
            }

            if (!result.autoSynced) {
                syncError.value = 'Auto-sync failed. Use manual adjustment.';
            }
        } catch (err) {
            syncError.value = err instanceof Error ? err.message : 'Sync error';
            syncConfig.value = { offsetSeconds: 0, autoSynced: false };
        } finally {
            isAutoSyncing.value = false;
        }
    }

    function reset(): void {
        syncConfig.value = { offsetSeconds: 0, autoSynced: false };
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
        reset,
    };
});
