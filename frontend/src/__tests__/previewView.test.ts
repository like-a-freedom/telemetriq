/// <reference path="../../env.d.ts" />
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';

// mock useSeo (useHead) to avoid head injection in unit tests
vi.mock('../composables/useSeo', () => ({ useSeo: () => { } }));
vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }) }));

import PreviewView from '../views/PreviewView.vue';
import { useFilesStore } from '../stores/filesStore';
import { useSyncStore } from '../stores/syncStore';
import { useSettingsStore } from '../stores/settingsStore';

describe('PreviewView (synchronization panel)', () => {
    beforeEach(() => {
        setActivePinia(createPinia());
    });

    function makeStores({ autoSynced }: { autoSynced: boolean }) {
        const files = useFilesStore();
        // make filesStore.isReady === true so component doesn't redirect
        files.videoFile = new File([], 'video.mp4');
        files.videoMeta = { duration: 10, startTime: new Date() } as any;
        files.gpxFile = new File(['<gpx></gpx>'], 'track.gpx');
        files.gpxData = { points: [], creator: 'unit', bounds: { minLat: 0, maxLat: 0, minLon: 0, maxLon: 0 } } as any;

        const sync = useSyncStore();
        sync.syncConfig = { offsetSeconds: 0, autoSynced } as any;

        const settings = useSettingsStore();
        settings.reset();

        return { files, sync, settings };
    }

    it('is collapsed by default when auto-sync succeeded', () => {
        makeStores({ autoSynced: true });

        const wrapper = mount(PreviewView, {
            global: { stubs: ['VideoPlayer', 'SyncSlider', 'TemplateSelector'] },
        });

        const toggle = wrapper.find('[data-testid="sync-collapse-toggle"]');
        expect(toggle.exists()).toBe(true);
        expect(toggle.attributes('aria-expanded')).toBe('false');

        const section = wrapper.find('#sync-section');
        expect(section.exists()).toBe(true);
        // visibility is represented by the toggle's aria-expanded attribute
        expect(toggle.attributes('aria-expanded')).toBe('false');
    });

    it('is expanded by default when auto-sync did not run', () => {
        makeStores({ autoSynced: false });

        const wrapper = mount(PreviewView, {
            global: { stubs: ['VideoPlayer', 'SyncSlider', 'TemplateSelector'] },
        });

        const toggle = wrapper.find('[data-testid="sync-collapse-toggle"]');
        expect(toggle.attributes('aria-expanded')).toBe('true');

        const section = wrapper.find('#sync-section');
        expect(section.isVisible()).toBe(true);
    });

    it('toggle button opens and closes the panel', async () => {
        makeStores({ autoSynced: true });

        const wrapper = mount(PreviewView, {
            global: { stubs: ['VideoPlayer', 'SyncSlider', 'TemplateSelector'] },
        });

        const toggle = wrapper.find('[data-testid="sync-collapse-toggle"]');

        // initially collapsed
        expect(toggle.attributes('aria-expanded')).toBe('false');

        await toggle.trigger('click');
        expect(toggle.attributes('aria-expanded')).toBe('true');

        await toggle.trigger('click');
        expect(toggle.attributes('aria-expanded')).toBe('false');
    });

    it('renders timezone select element with expected structure', () => {
        makeStores({ autoSynced: false });

        const wrapper = mount(PreviewView, {
            global: { stubs: ['VideoPlayer', 'SyncSlider', 'TemplateSelector'] },
        });

        const select = wrapper.find('.preview-view__timezone-row .preview-view__select');
        expect(select.exists()).toBe(true);
        // structural assertions (visuals are covered by e2e)
        expect(select.attributes('class')).toContain('preview-view__select');
        const label = wrapper.find('.preview-view__timezone-row .preview-view__label--small');
        expect(label.exists()).toBe(true);
        expect(label.text()).toMatch(/Timezone/i);
    });

    it('hides position control for templates with fixed placement', () => {
        const { settings } = makeStores({ autoSynced: false });
        settings.selectTemplate('margin');

        const wrapper = mount(PreviewView, {
            global: { stubs: ['VideoPlayer', 'SyncSlider', 'TemplateSelector', 'DateTimePicker'] },
        });

        expect(wrapper.text()).not.toContain('Position');
    });

    it('shows position control for templates that support position changes', () => {
        const { settings } = makeStores({ autoSynced: false });
        settings.selectTemplate('classic');

        const wrapper = mount(PreviewView, {
            global: { stubs: ['VideoPlayer', 'SyncSlider', 'TemplateSelector', 'DateTimePicker'] },
        });

        expect(wrapper.text()).toContain('Position');
    });

    it('renders the expanded telemetry metric controls for available metrics only', () => {
        makeStores({ autoSynced: false });

        const wrapper = mount(PreviewView, {
            global: { stubs: ['VideoPlayer', 'SyncSlider', 'TemplateSelector', 'DateTimePicker'] },
        });

        // Default horizon template supports: pace, hr, distance, time
        expect(wrapper.text()).toContain('Heart rate');
        expect(wrapper.text()).toContain('Pace');
        expect(wrapper.text()).toContain('Distance');
        expect(wrapper.text()).toContain('Time');
        // These are not supported by horizon template, so are hidden
        expect(wrapper.text()).not.toContain('Speed');
        expect(wrapper.text()).not.toContain('Grade');
        expect(wrapper.text()).not.toContain('Elevation');
        expect(wrapper.text()).not.toContain('Cadence');
        expect(wrapper.text()).not.toContain('Power');
    });

    it('does not render the noisy metric tag badges in the preview panel', () => {
        makeStores({ autoSynced: false });

        const wrapper = mount(PreviewView, {
            global: { stubs: ['VideoPlayer', 'SyncSlider', 'TemplateSelector', 'DateTimePicker'] },
        });

        expect(wrapper.findAll('.preview-view__metric-chip')).toHaveLength(0);
    });

    it('warns when trail-run is selected without elevation data', () => {
        const { settings } = makeStores({ autoSynced: false });
        settings.updateOverlayConfig({ templateId: 'trail-run' as never });

        const wrapper = mount(PreviewView, {
            global: { stubs: ['VideoPlayer', 'SyncSlider', 'TemplateSelector', 'DateTimePicker'] },
        });

        expect(wrapper.text()).toContain('Template data check');
        expect(wrapper.text()).toContain('Trail Run needs elevation samples');
        expect(wrapper.text()).toContain('will not be displayed');
    });

    it('warns when cycling-pro is selected without cadence and power data', () => {
        const { settings } = makeStores({ autoSynced: false });
        settings.updateOverlayConfig({ templateId: 'cycling-pro' as never });

        const wrapper = mount(PreviewView, {
            global: { stubs: ['VideoPlayer', 'SyncSlider', 'TemplateSelector', 'DateTimePicker'] },
        });

        expect(wrapper.text()).toContain('Template data check');
        expect(wrapper.text()).toContain('Cycling Pro has no cadence samples');
        expect(wrapper.text()).toContain('Cycling Pro has no power samples');
        expect(wrapper.text()).toContain('will not be displayed');
    });

    it('shows locked badges for template-required metrics', () => {
        const { settings } = makeStores({ autoSynced: false });
        settings.updateOverlayConfig({ templateId: 'cycling-pro' as never });

        const wrapper = mount(PreviewView, {
            global: { stubs: ['VideoPlayer', 'SyncSlider', 'TemplateSelector', 'DateTimePicker'] },
        });

        const lockedControls = wrapper.findAll('.preview-view__checkbox--locked');
        expect(lockedControls.length).toBeGreaterThan(0);
        expect(wrapper.text()).toContain('Locked');
    });
});
