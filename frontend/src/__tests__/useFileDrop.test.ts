import { describe, it, expect, vi, afterEach } from 'vitest';
import { useFileDrop } from '../composables/useFileDrop';

function makeInputElement(): HTMLInputElement {
    return {
        value: '',
        click: vi.fn(),
    } as unknown as HTMLInputElement;
}

function makeFileSelectedEvent(file?: File): Event {
    return { target: { files: file ? [file] : [] } } as unknown as Event;
}

function makeDropEvent(file?: File): DragEvent {
    return {
        dataTransfer: {
            files: file ? [file] : [],
        },
    } as unknown as DragEvent;
}

function makeFile(name = 'test.mp4', size = 1024): File {
    return new File([new ArrayBuffer(size)], name, { type: 'video/mp4' });
}

describe('useFileDrop', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('initial state', () => {
        it('fileInput starts as null', () => {
            const { fileInput } = useFileDrop();
            expect(fileInput.value).toBeNull();
        });

        it('isDragOver starts as false', () => {
            const { isDragOver } = useFileDrop();
            expect(isDragOver.value).toBe(false);
        });
    });

    describe('openFileDialog', () => {
        it('calls click() on the file input element', () => {
            const { fileInput, openFileDialog } = useFileDrop();
            const el = makeInputElement();
            fileInput.value = el;
            openFileDialog();
            expect(el.click).toHaveBeenCalledOnce();
        });

        it('does not throw when fileInput is null', () => {
            const { openFileDialog } = useFileDrop();
            expect(() => openFileDialog()).not.toThrow();
        });
    });

    describe('onFileSelected', () => {
        it('calls onFile with the selected file', () => {
            const { onFileSelected } = useFileDrop();
            const file = makeFile();
            const onFile = vi.fn();
            onFileSelected(makeFileSelectedEvent(file), onFile);
            expect(onFile).toHaveBeenCalledWith(file);
        });

        it('does not call onFile when no file is present', () => {
            const { onFileSelected } = useFileDrop();
            const onFile = vi.fn();
            onFileSelected(makeFileSelectedEvent(), onFile);
            expect(onFile).not.toHaveBeenCalled();
        });
    });

    describe('drag events', () => {
        it('onDragEnter sets isDragOver to true', () => {
            const { isDragOver, onDragEnter } = useFileDrop();
            onDragEnter();
            expect(isDragOver.value).toBe(true);
        });

        it('onDragOver sets isDragOver to true', () => {
            const { isDragOver, onDragOver } = useFileDrop();
            onDragOver();
            expect(isDragOver.value).toBe(true);
        });

        it('onDragLeave sets isDragOver to false', () => {
            const { isDragOver, onDragEnter, onDragLeave } = useFileDrop();
            onDragEnter();
            expect(isDragOver.value).toBe(true);
            onDragLeave();
            expect(isDragOver.value).toBe(false);
        });

        it('onDragOver does not toggle off', () => {
            const { isDragOver, onDragOver, onDragLeave } = useFileDrop();
            onDragOver();
            expect(isDragOver.value).toBe(true);
            onDragOver();
            expect(isDragOver.value).toBe(true);
            onDragLeave();
            expect(isDragOver.value).toBe(false);
        });
    });

    describe('onDrop', () => {
        it('calls onFile with the dropped file', () => {
            const { onDrop } = useFileDrop();
            const file = makeFile();
            const onFile = vi.fn();
            onDrop(makeDropEvent(file), onFile);
            expect(onFile).toHaveBeenCalledWith(file);
        });

        it('sets isDragOver to false', () => {
            const { isDragOver, onDragEnter, onDrop } = useFileDrop();
            onDragEnter();
            expect(isDragOver.value).toBe(true);
            onDrop(makeDropEvent(), vi.fn());
            expect(isDragOver.value).toBe(false);
        });

        it('does not call onFile when no files in transfer', () => {
            const { onDrop } = useFileDrop();
            const onFile = vi.fn();
            onDrop(makeDropEvent(), onFile);
            expect(onFile).not.toHaveBeenCalled();
        });

        it('always clears isDragOver regardless of file presence', () => {
            const { isDragOver, onDragEnter, onDrop } = useFileDrop();
            onDragEnter();
            onDrop(makeDropEvent(), vi.fn());
            expect(isDragOver.value).toBe(false);
        });
    });

    describe('resetInput', () => {
        it('clears the input element value', () => {
            const { fileInput, resetInput } = useFileDrop();
            const el = makeInputElement();
            el.value = 'C:\\fake\\path\\file.mp4';
            fileInput.value = el;
            resetInput();
            expect(el.value).toBe('');
        });

        it('does not throw when fileInput is null', () => {
            const { resetInput } = useFileDrop();
            expect(() => resetInput()).not.toThrow();
        });
    });
});
