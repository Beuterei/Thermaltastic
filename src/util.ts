// Helper methods that replace cpp functionality with ts or additional stuff

// eslint-disable-next-line id-length
export const C = (char: string) => {
    const code = char.codePointAt(0);

    if (!code) {
        throw new Error('Could not get code point');
    }

    return code;
};

export const delay = async (ms: number) =>
    // eslint-disable-next-line no-return-await
    await new Promise(resolve => {
        setTimeout(resolve, ms);
    });
