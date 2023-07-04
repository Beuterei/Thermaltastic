import { C, delay } from '../src/util';

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
        const start = Date.now();

        await delay(100);

        expect(Date.now() - start).toBeGreaterThanOrEqual(100);
    });
});
