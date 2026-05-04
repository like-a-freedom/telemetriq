/// <reference path="../../env.d.ts" />
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";

const push = vi.fn();

vi.mock("vue-router", () => ({
  useRouter: () => ({ push }),
}));
vi.mock("../composables/useSeo", () => ({ useSeo: () => {} }));
vi.mock("../modules/browserCapabilities", () => ({
  shouldAvoidInlineResultPreview: () => false,
}));

// In-memory IndexedDB stub for BrowserFileSystem mock
const persistedFiles = new Map<string, Blob>();
const indexedDbStub = {} as IDBFactory;

vi.mock("../modules/fileSystem", () => ({
  BrowserFileSystem: class {
    async writeFile(key: string, data: Blob): Promise<void> {
      persistedFiles.set(key, data);
    }

    async readFile(key: string): Promise<Blob | null> {
      return persistedFiles.get(key) ?? null;
    }

    async deleteFile(key: string): Promise<void> {
      persistedFiles.delete(key);
    }

    async listFiles(): Promise<string[]> {
      return [...persistedFiles.keys()];
    }
  },
}));

import ResultView from "../views/ResultView.vue";
import { useFilesStore } from "../stores/filesStore";
import { useProcessingStore } from "../stores/processingStore";
import { useSettingsStore } from "../stores/settingsStore";
import { useSyncStore } from "../stores/syncStore";

describe("ResultView", () => {
  beforeEach(() => {
    push.mockReset();
    persistedFiles.clear();
    vi.stubGlobal("indexedDB", indexedDbStub);
    setActivePinia(createPinia());
  });

  describe("result restoration", () => {
    it("does not redirect when result blob already exists in store", async () => {
      const processingStore = useProcessingStore();
      processingStore.setResult(
        new Blob(["processed-video"], { type: "video/mp4" }),
      );

      mount(ResultView, {
        global: { stubs: { FileInfo: true } },
      });

      await flushPromises();

      expect(push).not.toHaveBeenCalled();
    });

    it("redirects to home when no result and no persisted blob in IndexedDB", async () => {
      const processingStore = useProcessingStore();
      processingStore.reset();

      mount(ResultView, {
        global: { stubs: { FileInfo: true } },
      });

      await flushPromises();

      expect(push).toHaveBeenCalledWith("/");
    });

    it("restores result from IndexedDB when blob is missing from memory but persisted", async () => {
      const processingStore = useProcessingStore();
      const resultBlob = new Blob(["persisted-result"], {
        type: "video/mp4",
      });

      // Simulate persist like finalizeResult does
      processingStore.startProcessing(24);
      await processingStore.finalizeResult(resultBlob);

      // Simulate page reload: reset Pinia store
      setActivePinia(createPinia());
      const freshStore = useProcessingStore();

      // Blob should not be in memory yet
      expect(freshStore.hasResult).toBe(false);

      mount(ResultView, {
        global: { stubs: { FileInfo: true } },
      });

      await flushPromises();

      // Should have restored from IndexedDB and not redirected
      expect(push).not.toHaveBeenCalled();
      expect(freshStore.hasResult).toBe(true);
      expect(freshStore.resultBlob).not.toBeNull();
    });
  });

  describe("downloadResult", () => {
    it("uses showSaveFilePicker when available and writes blob", async () => {
      const processingStore = useProcessingStore();
      processingStore.finalizeResult(
        new Blob(["processed-video"], { type: "video/mp4" }),
      );

      const filesStore = useFilesStore();
      // Mock videoMeta for filename
      (filesStore as any).videoMeta = { fileName: "test.mp4" };

      const mockWritable = {
        write: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
      };
      const mockHandle = {
        createWritable: vi.fn().mockResolvedValue(mockWritable),
      };
      const mockShowSaveFilePicker = vi.fn().mockResolvedValue(mockHandle);

      // Inject showSaveFilePicker into window
      (window as any).showSaveFilePicker = mockShowSaveFilePicker;

      const wrapper = mount(ResultView, {
        global: { stubs: { FileInfo: true } },
      });

      await flushPromises();

      const downloadBtn = wrapper.find('[data-testid="download-btn"]');
      await downloadBtn.trigger("click");
      await flushPromises();

      expect(mockShowSaveFilePicker).toHaveBeenCalledWith(
        expect.objectContaining({
          suggestedName: "test_overlay.mp4",
          types: [
            {
              description: "MP4 Video",
              accept: { "video/mp4": [".mp4"] },
            },
          ],
        }),
      );
      expect(mockHandle.createWritable).toHaveBeenCalled();
      expect(mockWritable.write).toHaveBeenCalledWith(expect.any(Blob));
      expect(mockWritable.close).toHaveBeenCalled();

      delete (window as any).showSaveFilePicker;
    });

    it("falls back to link click when showSaveFilePicker throws non-AbortError", async () => {
      const processingStore = useProcessingStore();
      await processingStore.finalizeResult(
        new Blob(["processed-video"], { type: "video/mp4" }),
      );

      const filesStore = useFilesStore();
      (filesStore as any).videoMeta = { fileName: "test.mp4" };

      const mockedClick = vi.fn();
      const originalCreateElement = document.createElement.bind(document);
      const createElementSpy = vi
        .spyOn(document, "createElement")
        .mockImplementation((tag: string, _options?: any) => {
          const el = originalCreateElement(tag);
          if (tag === "a") {
            // Override click to prevent navigation
            Object.defineProperty(el, "click", {
              value: mockedClick,
              writable: false,
            });
          }
          return el;
        });

      // showSaveFilePicker throws a non-AbortError
      const mockShowSaveFilePicker = vi
        .fn()
        .mockRejectedValue(new Error("Not supported"));
      (window as any).showSaveFilePicker = mockShowSaveFilePicker;

      const wrapper = mount(ResultView, {
        global: { stubs: { FileInfo: true } },
      });

      await flushPromises();

      const downloadBtn = wrapper.find('[data-testid="download-btn"]');
      await downloadBtn.trigger("click");
      await flushPromises();

      expect(mockShowSaveFilePicker).toHaveBeenCalled();
      // Fallback: link was clicked
      expect(mockedClick).toHaveBeenCalled();

      createElementSpy.mockRestore();
      delete (window as any).showSaveFilePicker;
    });

    it("aborts silently when user cancels showSaveFilePicker (AbortError)", async () => {
      const processingStore = useProcessingStore();
      await processingStore.finalizeResult(
        new Blob(["processed-video"], { type: "video/mp4" }),
      );

      const filesStore = useFilesStore();
      (filesStore as any).videoMeta = { fileName: "test.mp4" };

      const mockedClick = vi.fn();
      const originalCreateElement = document.createElement.bind(document);
      const createElementSpy = vi
        .spyOn(document, "createElement")
        .mockImplementation((tag: string, _options?: any) => {
          const el = originalCreateElement(tag);
          if (tag === "a") {
            Object.defineProperty(el, "click", {
              value: mockedClick,
              writable: false,
            });
          }
          return el;
        });

      const abortError = new Error("User cancelled");
      abortError.name = "AbortError";
      const mockShowSaveFilePicker = vi.fn().mockRejectedValue(abortError);
      (window as any).showSaveFilePicker = mockShowSaveFilePicker;

      const wrapper = mount(ResultView, {
        global: { stubs: { FileInfo: true } },
      });

      await flushPromises();

      const downloadBtn = wrapper.find('[data-testid="download-btn"]');
      await downloadBtn.trigger("click");
      await flushPromises();

      expect(mockShowSaveFilePicker).toHaveBeenCalled();
      // Fallback should NOT be called on AbortError
      expect(mockedClick).not.toHaveBeenCalled();

      createElementSpy.mockRestore();
      delete (window as any).showSaveFilePicker;
    });

    it("generates correct filename from videoMeta", async () => {
      const processingStore = useProcessingStore();
      await processingStore.finalizeResult(
        new Blob(["processed-video"], { type: "video/mp4" }),
      );

      const filesStore = useFilesStore();
      (filesStore as any).videoMeta = {
        fileName: "my_run_2024.mp4",
      };

      const mockShowSaveFilePicker = vi.fn().mockResolvedValue({
        createWritable: vi.fn().mockResolvedValue({
          write: vi.fn().mockResolvedValue(undefined),
          close: vi.fn().mockResolvedValue(undefined),
        }),
      });
      (window as any).showSaveFilePicker = mockShowSaveFilePicker;

      const wrapper = mount(ResultView, {
        global: { stubs: { FileInfo: true } },
      });

      await flushPromises();

      const downloadBtn = wrapper.find('[data-testid="download-btn"]');
      await downloadBtn.trigger("click");
      await flushPromises();

      expect(mockShowSaveFilePicker).toHaveBeenCalledWith(
        expect.objectContaining({
          suggestedName: "my_run_2024_overlay.mp4",
        }),
      );

      delete (window as any).showSaveFilePicker;
    });

    it('uses fallback "video" when videoMeta has no fileName', async () => {
      const processingStore = useProcessingStore();
      await processingStore.finalizeResult(
        new Blob(["processed-video"], { type: "video/mp4" }),
      );

      // videoMeta without fileName
      (useFilesStore() as any).videoMeta = {};

      const mockShowSaveFilePicker = vi.fn().mockResolvedValue({
        createWritable: vi.fn().mockResolvedValue({
          write: vi.fn().mockResolvedValue(undefined),
          close: vi.fn().mockResolvedValue(undefined),
        }),
      });
      (window as any).showSaveFilePicker = mockShowSaveFilePicker;

      const wrapper = mount(ResultView, {
        global: { stubs: { FileInfo: true } },
      });

      await flushPromises();

      const downloadBtn = wrapper.find('[data-testid="download-btn"]');
      await downloadBtn.trigger("click");
      await flushPromises();

      expect(mockShowSaveFilePicker).toHaveBeenCalledWith(
        expect.objectContaining({
          suggestedName: "video_overlay.mp4",
        }),
      );

      delete (window as any).showSaveFilePicker;
    });
  });

  describe("startOver", () => {
    it("resets all stores and redirects to home", async () => {
      const processingStore = useProcessingStore();
      await processingStore.finalizeResult(
        new Blob(["processed-video"], { type: "video/mp4" }),
      );

      const filesStore = useFilesStore();
      const syncStore = useSyncStore();
      const settingsStore = useSettingsStore();

      const filesResetSpy = vi.spyOn(filesStore, "reset");
      const syncResetSpy = vi.spyOn(syncStore, "reset");
      const procResetSpy = vi.spyOn(processingStore, "reset");
      const settingsResetSpy = vi.spyOn(settingsStore, "reset");

      const wrapper = mount(ResultView, {
        global: { stubs: { FileInfo: true } },
      });

      await flushPromises();

      const startOverBtn = wrapper.find('[data-testid="start-over-btn"]');
      await startOverBtn.trigger("click");

      expect(filesResetSpy).toHaveBeenCalled();
      expect(syncResetSpy).toHaveBeenCalled();
      expect(procResetSpy).toHaveBeenCalled();
      expect(settingsResetSpy).toHaveBeenCalled();
      expect(push).toHaveBeenCalledWith("/");
    });
  });

  describe("preview visibility", () => {
    it("shows video preview when resultUrl exists and device supports inline preview", async () => {
      const processingStore = useProcessingStore();
      processingStore.setResult(
        new Blob(["processed-video"], { type: "video/mp4" }),
      );

      const wrapper = mount(ResultView, {
        global: { stubs: { FileInfo: true } },
      });

      await flushPromises();

      expect(wrapper.find('[data-testid="result-video"]').exists()).toBe(true);
    });
  });
});
