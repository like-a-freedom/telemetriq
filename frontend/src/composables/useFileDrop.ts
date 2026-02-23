import { ref } from 'vue';

export interface FileDropHandlers {
    readonly fileInput: ReturnType<typeof ref<HTMLInputElement | null>>;
    readonly isDragOver: ReturnType<typeof ref<boolean>>;
    openFileDialog: () => void;
    onFileSelected: (event: Event, onFile: (file: File) => void) => void;
    onDragEnter: () => void;
    onDragOver: () => void;
    onDragLeave: () => void;
    onDrop: (event: DragEvent, onFile: (file: File) => void) => void;
    resetInput: () => void;
}

export function useFileDrop(): FileDropHandlers {
    const fileInput = ref<HTMLInputElement | null>(null);
    const isDragOver = ref(false);

    function openFileDialog(): void {
        fileInput.value?.click();
    }

    function onFileSelected(event: Event, onFile: (file: File) => void): void {
        const target = event.target as HTMLInputElement;
        const file = target.files?.[0];
        if (file) {
            onFile(file);
        }
    }

    function onDragEnter(): void {
        isDragOver.value = true;
    }

    function onDragOver(): void {
        isDragOver.value = true;
    }

    function onDragLeave(): void {
        isDragOver.value = false;
    }

    function onDrop(event: DragEvent, onFile: (file: File) => void): void {
        isDragOver.value = false;
        const file = event.dataTransfer?.files[0];
        if (file) {
            onFile(file);
        }
    }

    function resetInput(): void {
        if (fileInput.value) {
            fileInput.value.value = '';
        }
    }

    return {
        fileInput,
        isDragOver,
        openFileDialog,
        onFileSelected,
        onDragEnter,
        onDragOver,
        onDragLeave,
        onDrop,
        resetInput,
    };
}
