/* eslint-disable @typescript-eslint/prefer-literal-enum-member */
/* eslint-disable no-bitwise */

import { C } from './util';

// Internal character sets used with ESC R n
export enum CharacterSet {
    USA = 0, // American character set
    FRANCE = 1, // French character set
    GERMANY = 2, // German character set
    UK = 3, // UK character set
    DENMARK1 = 4, // Danish character set 1
    SWEDEN = 5, // Swedish character set
    ITALY = 6, // Italian character set
    SPAIN1 = 7, // Spanish character set 1
    JAPAN = 8, // Japanese character set
    NORWAY = 9, // Norwegian character set
    DENMARK2 = 10, // Danish character set 2
    SPAIN2 = 11, // Spanish character set 2
    LATINAMERICA = 12, // Latin American character set
    KOREA = 13, // Korean character set
    SLOVENIA = 14, // Slovenian character set
    CROATIA = 14, // Croatian character set
    CHINA = 15, // Chinese character set
}

// Character code tables used with ESC t n
export enum CodePage {
    CP437 = 0, // USA, Standard Europe character code table
    KATAKANA = 1, // Katakana (Japanese) character code table
    CP850 = 2, // Multilingual character code table
    CP860 = 3, // Portuguese character code table
    CP863 = 4, // Canadian-French character code table
    CP865 = 5, // Nordic character code table
    WCP1251 = 6, // Cyrillic character code table
    CP866 = 7, // Cyrillic #2 character code table
    MIK = 8, // Cyrillic/Bulgarian character code table
    CP755 = 9, // East Europe, Latvian 2 character code table
    IRAN = 10, // Iran 1 character code table
    CP862 = 15, // Hebrew character code table
    WCP1252 = 16, // Latin 1 character code table
    WCP1253 = 17, // Greek character code table
    CP852 = 18, // Latin 2 character code table
    CP858 = 19, // Multilingual Latin 1 + Euro character code table
    IRAN2 = 20, // Iran 2 character code table
    LATVIAN = 21, // Latvian character code table
    CP864 = 22, // Arabic character code table
    ISO_8859_1 = 23, // West Europe character code table
    CP737 = 24, // Greek character code table
    WCP1257 = 25, // Baltic character code table
    THAI = 26, // Thai character code table
    CP720 = 27, // Arabic character code table
    CP855 = 28, // Cyrillic character code table
    CP857 = 29, // Turkish character code table
    WCP1250 = 30, // Central Europe character code table
    CP775 = 31, // Baltic character code table
    WCP1254 = 32, // Turkish character code table
    WCP1255 = 33, // Hebrew character code table
    WCP1256 = 34, // Arabic character code table
    WCP1258 = 35, // Vietnam character code table
    ISO_8859_2 = 36, // Latin 2 character code table
    ISO_8859_3 = 37, // Latin 3 character code table
    ISO_8859_4 = 38, // Baltic character code table
    ISO_8859_5 = 39, // Cyrillic character code table
    ISO_8859_6 = 40, // Arabic character code table
    ISO_8859_7 = 41, // Greek character code table
    ISO_8859_8 = 42, // Hebrew character code table
    ISO_8859_9 = 43, // Turkish character code table
    ISO_8859_15 = 44, // Latin 3 character code table
    THAI2 = 45, // Thai 2 character code page
    CP856 = 46, // Hebrew character code page
    CP874 = 47, // Thai character code page
}

/*
 * Barcode types used with GS k m
 */
export enum Barcode {
    UPC_A = 0, // UPC-A barcode system. 11-12 char
    UPC_E = 1, // UPC-E barcode system. 11-12 char
    EAN13 = 2, // EAN13 (JAN13) barcode system. 12-13 char
    EAN8 = 3, // EAN8 (JAN8) barcode system. 7-8 char
    CODE39 = 4, // CODE39 barcode system. 1<=num of chars
    ITF = 5, // ITF barcode system. 1<=num of chars, must be an even number
    CODABAR = 6, // CODABAR barcode system. 1<=num<=255
    CODE93 = 7, // CODE93 barcode system. 1<=num<=255
    CODE128 = 8, // CODE128 barcode system. 2<=num<=255
}

export enum AsciiCode {
    TAB = C('\t'), // Horizontal tab
    LF = C('\n'), // Line feed
    FF = C('\f'), // Form feed
    CR = C('\r'), // Carriage return
    DC2 = 18, // Device control 2
    ESC = 27, // Escape
    FS = 28, // Field separator
    GS = 29, // Group separator
}

export enum CharacterCommands {
    // eslint-disable-next-line unicorn/prefer-math-trunc
    FONT_MASK = 1 << 0, // Select character font A or B
    INVERSE_MASK = 1 << 1, // Turn on/off white/black reverse printing mode. Not in 2.6.8 firmware (see inverseOn())
    UPDOWN_MASK = 1 << 2, // Turn on/off upside-down printing mode
    BOLD_MASK = 1 << 3, // Turn on/off bold printing mode
    DOUBLE_HEIGHT_MASK = 1 << 4, // Turn on/off double-height printing mode
    DOUBLE_WIDTH_MASK = 1 << 5, // Turn on/off double-width printing mode
    STRIKE_MASK = 1 << 6, // Turn on/off deleteline mode
}
