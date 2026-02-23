import { ref } from 'vue';
import { formatErrorMessage } from '../stores/error-formatter';

export interface AsyncState<T> {
    readonly data: T | null;
    readonly isLoading: boolean;
    readonly error: string | null;
    execute: (asyncFn: () => Promise<T>) => Promise<T | null>;
    reset: () => void;
}

export interface UseAsyncStateOptions {
    /** Initial data value */
    initialValue?: null;
    /** Custom error message transformer */
    transformError?: (err: unknown) => string;
}

export function useAsyncState<T>(options?: UseAsyncStateOptions): AsyncState<T> {
    const { transformError = formatErrorMessage } = options ?? {};

    const data = ref<T | null>(options?.initialValue ?? null);
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
            error.value = transformError(err);
            return null;
        } finally {
            isLoading.value = false;
        }
    }

    function reset(): void {
        data.value = options?.initialValue ?? null;
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
