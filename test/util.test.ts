import { C, delay } from '../src/util';

describe('util', () => {
    beforeEach(() => {
        jest.useFakeTimers().setSystemTime(new Date('2023-01-01'));
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('C', () => {
        it('should return character code for simple characters', () => {
            expect(C('a')).toBe(97);
        });

        it('should return character code for special characters', () => {
            expect(C('\n')).toBe(10);
        });

        it('should throw when code cannot be found', () => {
            expect(() => C('')).toThrow(Error);
        });
    });

    describe('delay', () => {
        it('should delay for milliseconds', async () => {
            expect.assertions(1);
            const waitTime = 100;

            const delayPromise = delay(waitTime);

            jest.advanceTimersByTime(waitTime);

            await expect(delayPromise).resolves.toBeUndefined();
        });
    });
});
