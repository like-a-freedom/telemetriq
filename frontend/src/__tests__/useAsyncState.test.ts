import { describe, it, expect, vi } from 'vitest';
import { useAsyncState } from '../composables/useAsyncState';

describe('useAsyncState', () => {
    it('should have correct initial state', () => {
        const state = useAsyncState<string>();

        expect(state.data).toBeNull();
        expect(state.isLoading).toBe(false);
        expect(state.error).toBeNull();
    });

    it('should execute async function and set data on success', async () => {
        const state = useAsyncState<string>();
        const mockData = 'test result';
        const asyncFn = vi.fn().mockResolvedValue(mockData);

        const result = await state.execute(asyncFn);

        expect(result).toBe(mockData);
        expect(state.data).toBe(mockData);
        expect(state.isLoading).toBe(false);
        expect(state.error).toBeNull();
        expect(asyncFn).toHaveBeenCalledTimes(1);
    });

    it('should set loading state during execution', async () => {
        const state = useAsyncState<string>();
        let loadingDuringExecution = false;

        const asyncFn = vi.fn().mockImplementation(async () => {
            loadingDuringExecution = state.isLoading;
            return 'result';
        });

        await state.execute(asyncFn);

        expect(loadingDuringExecution).toBe(true);
        expect(state.isLoading).toBe(false);
    });

    it('should handle errors and set error state', async () => {
        const state = useAsyncState<string>();
        const errorMessage = 'Test error';
        const asyncFn = vi.fn().mockRejectedValue(new Error(errorMessage));

        const result = await state.execute(asyncFn);

        expect(result).toBeNull();
        expect(state.data).toBeNull();
        expect(state.isLoading).toBe(false);
        expect(state.error).toContain(errorMessage);
    });

    it('should handle non-Error exceptions', async () => {
        const state = useAsyncState<string>();
        const asyncFn = vi.fn().mockRejectedValue('string error');

        await state.execute(asyncFn);

        expect(state.error).toBe('string error');
        expect(state.isLoading).toBe(false);
    });

    it('should reset state to initial values', async () => {
        const state = useAsyncState<string>();

        // Set some state
        await state.execute(vi.fn().mockResolvedValue('data'));
        expect(state.data).toBe('data');

        // Reset
        state.reset();

        expect(state.data).toBeNull();
        expect(state.isLoading).toBe(false);
        expect(state.error).toBeNull();
    });

    it('should handle sequential executions', async () => {
        const state = useAsyncState<number>();

        // First execution
        await state.execute(vi.fn().mockResolvedValue(1));
        expect(state.data).toBe(1);
        expect(state.error).toBeNull();

        // Second execution with error - data is not cleared on error
        await state.execute(vi.fn().mockRejectedValue(new Error('fail')));
        expect(state.data).toBe(1); // Data preserved from previous success
        expect(state.error).toContain('fail');

        // Third execution success - clears error
        await state.execute(vi.fn().mockResolvedValue(3));
        expect(state.data).toBe(3);
        expect(state.error).toBeNull();
    });

    it('should work with different data types', async () => {
        // Test with object
        const objectState = useAsyncState<{ id: number; name: string }>();
        const testObj = { id: 1, name: 'test' };
        await objectState.execute(vi.fn().mockResolvedValue(testObj));
        expect(objectState.data).toEqual(testObj);

        // Test with array
        const arrayState = useAsyncState<number[]>();
        const testArray = [1, 2, 3];
        await arrayState.execute(vi.fn().mockResolvedValue(testArray));
        expect(arrayState.data).toEqual(testArray);

        // Test with number
        const numberState = useAsyncState<number>();
        await numberState.execute(vi.fn().mockResolvedValue(42));
        expect(numberState.data).toBe(42);
    });
});
