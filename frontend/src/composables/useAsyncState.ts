import { ref } from 'vue';
import { formatErrorMessage } from '../stores/store-utils';

export interface AsyncState<T> {
    data: T | null;
    isLoading: boolean;
    error: string | null;
    execute: (asyncFn: () => Promise<T>) => Promise<T | null>;
    reset: () => void;
}

export function useAsyncState<T>(): AsyncState<T> {
    const data = ref<T | null>(null);
    const isLoading = ref(false);
    const error = ref<string | null>(null);

    async function execute(asyncFn: () => Promise<T>): Promise<T | null> {
        isLoading.value = true;
        error.value = null;

        try {
            const result = await asyncFn();
            data.value = result;
            return result;
        } catch (err) {
            error.value = formatErrorMessage(err);
            return null;
        } finally {
            isLoading.value = false;
        }
    }

    function reset(): void {
        data.value = null;
        isLoading.value = false;
        error.value = null;
    }

    return {
        get data() { return data.value; },
        get isLoading() { return isLoading.value; },
        get error() { return error.value; },
        execute,
        reset,
    };
}
