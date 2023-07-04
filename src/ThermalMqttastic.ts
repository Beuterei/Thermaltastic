/* eslint-disable no-bitwise */
/* eslint-disable @typescript-eslint/member-ordering */

/**
 * An typescript library for the Adafruit Thermal Printer:
 *
 * https://www.adafruit.com/product/597
 *
 * These printers use TTL serial to communicate.  One pin (5V or 3.3V) is
 * required to issue data to the printer.  A second pin can OPTIONALLY be
 * used to poll the paper status, but not all printers support this, and
 * the output on this pin is 5V which may be damaging to some MCUs.
 *
 * This typescript adaptation is replacing the serial stream with a mqtt stream.
 * For this to work the corresponding arduino code needs to be installed on the MCU connected with the printer.
 *
 * Adafruit invests time and resources providing this open source code.
 * Please support Adafruit and open-source hardware by purchasing products
 * from Adafruit!
 *
 * Written by Limor Fried/Ladyada for Adafruit Industries, with
 * contributions from the open source community.  Originally based on
 * Thermal library from bildr.org
 *
 * Rewritten in typescript by Luis Beu.
 *
 * MIT license, all text above must be included in any redistribution.
 */

import type { IClientOptions, AsyncMqttClient } from 'async-mqtt';
import { connectAsync } from 'async-mqtt';
import { z } from 'zod';
import type { Barcode } from './enums';
import { AsciiCode, CharacterCommands } from './enums';
import { C, delay } from './util';

// Though most of these printers are factory configured for 19200 baud
// operation, a few rare specimens instead work at 9600.  If so, change
// this constant.  This will NOT make printing slower!  The physical
// print and feed mechanisms are the bottleneck, not the port speed.
const BAUDRATE = 19_200; // How many bits per second the serial port should transfer

// Because there's no flow control between the printer and Arduino,
// special care must be taken to avoid overrunning the printer's buffer.
// Serial output is throttled based on serial speed as well as an estimate
// of the device's print and feed rates (relatively slow, being bound to
// moving parts and physical reality).  After an operation is issued to
// the printer (e.g. bitmap print), a timeout is set before which any
// other printer operations will be suspended.  This is generally more
// efficient than using delay() in that it allows the parent code to
// continue with other duties (e.g. receiving or decoding an image)
// while the printer physically completes the task.

/* !
 * Number of milliseconds to issue one byte to the printer.  11 bits
 * (not 8) to accommodate idle, start and stop bits.  Idle time might
 * be unnecessary, but erring on side of caution here.
 */
// I took the original nanosecond implementation and round up to the next millisecond number since we are in js
const BYTE_TIME = Math.ceil((11 * 1_000_000 + BAUDRATE / 2) / BAUDRATE);

// TODO: add multi client support with start/stop
export interface Logger {
    log?: (message: string) => void;
    table?: (table: object) => void;
}

export interface InitOptions {
    additionalStackTimeout?: number;
    logger?: Logger;
    mqttOptions?: IClientOptions;
    mqttUrl: string;
}

export class ThermalMqttastic {
    protected resumeTime = 0;

    protected prevByte = 0;

    protected column = 0;

    protected maxColumn = 32;

    protected charHeight = 24;

    protected lineSpacing = 6;

    protected barcodeHeight = 50;

    protected dotPrintTime = 0;

    protected dotFeedTime = 0;

    protected maxChunkHeight = 255;

    protected firmware = 268;

    protected printMode = 0;

    // Added class properties
    protected mqttClient?: AsyncMqttClient;

    protected mqttUrl: string;

    protected mqttOptions?: IClientOptions;

    protected logger?: Logger;

    protected additionalStackTimeout: number;

    // Constructor
    public constructor(initOptions: InitOptions) {
        this.additionalStackTimeout = initOptions.additionalStackTimeout ?? 20;
        this.logger = initOptions.logger;
        this.mqttUrl = initOptions.mqttUrl;
        this.mqttOptions = initOptions.mqttOptions;
    }

    // Additional functions
    // I wanted to stay as close as possible to the original implementation. This section is for functions not found there
    protected mayLog(message: string) {
        if (this.logger?.log) {
            this.logger.log(message);
        }
    }

    protected mayTable(table: object) {
        if (this.logger?.table) {
            this.logger.table(table);
        }
    }

    protected getByteTime(modifier = 1) {
        // additionalStackTimeout only gets added the modifier only effects the original BYTE_TIME
        return BYTE_TIME * modifier + this.additionalStackTimeout * 1_000_000; // additionalStackTimeout is in ms so we convert it to nanoseconds
    }

    protected async publish(topic: string, payload: string) {
        if (!this.mqttClient) {
            throw new Error('MQTT client is not initialized. Did you call begin()?');
        }

        await this.mqttClient.publish(topic, payload, { qos: 2 });
    }
    // Additional functions end

    // This method sets the estimated completion time for a just-issued task.
    // Rewritten for js with milliseconds
    // Probably overkill since we already added enough overhead but who cares if the printer is 5ms slower right?
    protected timeoutSet(timeout: number) {
        this.mayLog('timeoutSet called');

        // use Date.now() instead of micros() to prevent buffer overflow
        const calculatedTimeout = Math.ceil(timeout / 1_000_000);
        this.resumeTime = Date.now() + calculatedTimeout; // The code is written with nanoseconds we convert here back to ms and estimate the next full ms

        this.mayLog(`Timeout set to ${calculatedTimeout}`);
        this.mayTable({ resumeTime: this.resumeTime });
    }

    // This function waits (if necessary) for the prior task to complete.
    // Rewritten for js with milliseconds
    // Probably overkill since we already added enough overhead but who cares if the printer is 5ms slower right?
    protected async timeoutWait() {
        this.mayLog('timeoutWait called');

        if (this.resumeTime > Date.now()) {
            const delayCalculated = this.resumeTime - Date.now();
            this.mayLog(`Delay for ${delayCalculated}ms`);
            await delay(delayCalculated);
        }
    }

    // Printer performance may vary based on the power supply voltage,
    // thickness of paper, phase of the moon and other seemingly random
    // variables.  This method sets the times (in microseconds) for the
    // paper to advance one vertical 'dot' when printing and when feeding.
    // For example, in the default initialized state, normal-sized text is
    // 24 dots tall and the line spacing is 30 dots, so the time for one
    // line to be issued is approximately 24 * print time + 6 * feed time.
    // The default print and feed times are based on a random test unit,
    // but as stated above your reality may be influenced by many factors.
    // This lets you tweak the timing to avoid excessive delays and/or
    // overrunning the printer buffer.
    public setTimes(dotPrintTime: number, dotFeedTime: number) {
        this.mayLog('setTimes called');

        // Parameter validation
        z.number().int().nonnegative().parse(dotPrintTime);
        z.number().int().nonnegative().parse(dotFeedTime);

        this.dotPrintTime = dotPrintTime;
        this.dotFeedTime = dotFeedTime;
        this.mayTable({
            dotPrintTime,
            dotFeedTime,
        });
    }

    // Is used when issuing configuration commands, printing bitmaps or barcodes, etc.  Not when printing text.
    // The stream is here replaced with mqtt
    // Since mqtt is the most overhead in our chain we allow up to for bytes to be send at once. Every bulk function relaying on writeBytes should try to always fill up all 4
    protected async writeBytes(...bytes: [number, number?, number?, number?]) {
        this.mayLog('writeBytes called');

        const payloadString = bytes.join(',');

        await this.timeoutWait();
        await this.publish('writeBytes', payloadString);
        this.mayLog(`Written ${payloadString} to stream (writeBytes)`);

        this.timeoutSet(this.getByteTime(bytes.length));
    }

    public async print(message: string) {
        this.mayLog('print called');

        const chunks = message.match(/[\s\S]{1,4}/gu); // Split message into chunks of 4 characters

        if (!chunks) {
            throw new Error('Could not split string in chunks.');
        }

        this.mayLog(`Splitted in chunks of ${chunks}`);

        for (const chunk of chunks) {
            const [first, ...rest] = chunk.split('').map(C);
            await this.write(first, ...rest);
        }

        this.mayLog(`Printed ${message}`);
    }

    public async println(message: string) {
        this.mayLog('println called');
        await this.print(message);
        await this.write(C('\r'), C('\n'));
    }

    // TODO: rewrite printBarcode to bulk
    // The underlying method for all high-level printing (e.g. println()).
    // The stream is here replaced with mqtt
    // Since mqtt is the most overhead in our chain we allow up to for bytes to be send at once. Every bulk function relaying on writeBytes should try to always fill up all 4
    protected async write(...bytes: [number, number?, number?, number?]) {
        this.mayLog('write called');

        let payload: number[] = [];
        let temporaryByteTime = 0;

        const sendPayload = async () => {
            const payloadString = payload.join(',');

            await this.timeoutWait();
            await this.publish('write', payloadString);

            this.mayLog(`Written ${payloadString} to stream (write)`);

            this.timeoutSet(this.getByteTime(payload.length) + temporaryByteTime);

            payload = [];
            temporaryByteTime = 0;
        };

        const handleLineBreak = async () => {
            // If newline or wrap
            temporaryByteTime +=
                this.prevByte === C('\n')
                    ? (this.charHeight + this.lineSpacing) * this.dotFeedTime
                    : this.charHeight * this.dotPrintTime + this.lineSpacing * this.dotFeedTime;

            this.column = 0;
            this.prevByte = C('\n');
            this.mayTable({
                prevByte: this.prevByte,
                column: this.column,
            });

            payload.push(C('\n'));
            await sendPayload();
        };

        // Filter out unwanted characters
        const filteredBytes = bytes.filter(
            element => element !== undefined && element !== 13,
        ) as number[]; // -.- typescript

        for (const [index, byte] of filteredBytes.entries()) {
            if (byte === C('\n')) {
                await handleLineBreak();
                continue;
            }

            // Check if we reached a line breaking point
            if (this.column === this.maxColumn) {
                await handleLineBreak();
            }

            this.column++;
            this.prevByte = byte;
            this.mayTable({
                prevByte: this.prevByte,
                column: this.column,
            });

            payload.push(byte);

            // Send when we collected a mqtt package of 4 bytes or we reached the end of the loop
            if (payload.length === 4 || index === filteredBytes.length - 1) {
                await sendPayload();
            }
        }
    }

    public async begin(firmware = 268) {
        this.mayLog('begin called');

        // Parameter validation
        z.number().int().nonnegative().parse(firmware);

        // Wait for mqtt connection
        this.mayLog('Connecting to MQTT');
        this.mqttClient = await connectAsync(this.mqttUrl, this.mqttOptions);
        this.mayLog('MQTT connection successful');

        this.firmware = firmware;
        this.mayTable({ firmware });

        // The printer can't start receiving data immediately upon power up --
        // it needs a moment to cold boot and initialize.  Allow at least 2
        // sec of uptime before printer can receive data.
        // TODO: replace with ready mqtt communication
        this.timeoutSet(2_000_000);

        await this.wake();

        await this.reset();

        // TODO: broken for my printer
        // await this.setHeatConfig();

        // See comments near top of file for an explanation of these values.
        this.dotPrintTime = 30_000;
        this.dotFeedTime = 2_100;
        this.maxChunkHeight = 255;
        this.mayTable({
            dotPrintTime: this.dotPrintTime,
            dotFeedTime: this.dotFeedTime,
            maxChunkHeight: this.maxChunkHeight,
        });
    }

    // Reset printer to default state.
    public async reset() {
        this.mayLog('reset called');

        await this.writeBytes(AsciiCode.ESC, C('@')); // Init command

        this.prevByte = C('\n'); // Treat as if prior line is blank
        this.column = 0;
        this.maxColumn = 32;
        this.charHeight = 24;
        this.lineSpacing = 6;
        this.barcodeHeight = 50;
        this.mayTable({
            prevByte: this.prevByte,
            column: this.column,
            maxColumn: this.maxColumn,
            charHeight: this.charHeight,
            lineSpacing: this.lineSpacing,
            barcodeHeight: this.barcodeHeight,
        });

        if (this.firmware >= 264) {
            // Configure tab stops on recent printers
            await this.writeBytes(AsciiCode.ESC, C('D')); // Set tab stops...
            await this.writeBytes(4, 8, 12, 16); // ...every 4 columns,
            await this.writeBytes(20, 24, 28, 0); // 0 marks end-of-list.
        }
    }

    // Reset text formatting parameters.
    public async setDefaults() {
        this.mayLog('setDefaults called');

        await this.online();
        await this.justify();
        await this.inverseOff();
        await this.doubleHeightOff();
        await this.setLineHeight();
        await this.boldOff();
        await this.underlineOff();
        await this.setBarcodeHeight();
        await this.setSize();
        await this.setCharset();
        await this.setCodePage();
    }

    public async test() {
        this.mayLog('test called');

        await this.println('Hello World!');
        await this.feed(2);
    }

    public async testPage() {
        this.mayLog('testPage called');

        await this.writeBytes(AsciiCode.DC2, C('T'));
        this.timeoutSet(
            this.dotPrintTime * 24 * 26 + // 26 lines w/text (ea. 24 dots high)
                this.dotFeedTime * (6 * 26 + 30),
        ); // 26 text lines (feed 6 dots) + blank line
    }

    public async setBarcodeHeight(barcodeHeight = 50) {
        this.mayLog('setBarcodeHeight called');

        // Parameter validation
        z.number().int().nonnegative().parse(barcodeHeight);

        this.barcodeHeight = barcodeHeight;
        this.mayTable({
            barcodeHeight,
        });

        await this.writeBytes(AsciiCode.GS, C('h'), barcodeHeight);
    }

    public async printBarcode(text: string, type: Barcode) {
        this.mayLog('printBarcode called');

        // Parameter validation
        z.string().max(255).parse(text);

        let cType = type;

        await this.feed(1); // Recent firmware can't print barcode w/o feed first???
        if (this.firmware >= 264) {
            cType += 65;
        }

        await this.writeBytes(AsciiCode.GS, C('H'), 2); // Print label below barcode
        await this.writeBytes(AsciiCode.GS, C('w'), 3); // Barcode width 3 (0.375/1.0mm thin/thick)
        await this.writeBytes(AsciiCode.GS, C('k'), cType); // Barcode type (listed in .h file)

        if (this.firmware >= 264) {
            const length = text.length;
            await this.writeBytes(length); // Write length byte
            for (let index = 0; index < length; index++) {
                await this.writeBytes(C(text[index])); // Write string sans NUL
            }
        } else {
            for (const element of text) {
                await this.writeBytes(C(element));
            }

            await this.writeBytes(0);
        }

        this.timeoutSet((this.barcodeHeight + 40) * this.dotPrintTime);

        this.prevByte = C('\n');
        this.mayTable({
            prevByte: this.prevByte,
        });
    }

    protected adjustCharValues(printMode: number) {
        this.mayLog('adjustCharValues called');

        let charWidth;
        if (printMode & CharacterCommands.FONT_MASK) {
            // FontB
            this.charHeight = 17;
            charWidth = 9;
        } else {
            // FontA
            this.charHeight = 24;
            charWidth = 12;
        }

        // Double Width Mode
        if (printMode & CharacterCommands.DOUBLE_WIDTH_MASK) {
            this.maxColumn = Math.floor(this.maxColumn / 2);
            charWidth *= 2;
        }

        // Double Height Mode
        if (printMode & CharacterCommands.DOUBLE_HEIGHT_MASK) {
            this.charHeight *= 2;
        }

        this.maxColumn = Math.floor(384 / charWidth);
        this.mayTable({
            charHeight: this.charHeight,
            maxColumn: this.maxColumn,
        });
    }

    protected async setPrintMode(mask: number) {
        this.mayLog('setPrintMode called');

        this.printMode |= mask;
        this.mayTable({
            printMode: this.printMode,
        });

        await this.writePrintMode();

        this.adjustCharValues(this.printMode);

        // this.charHeight = (this.printMode & CharacterCommands.DOUBLE_HEIGHT_MASK) ? 48 : 24;
        // this.maxColumn = (this.printMode & CharacterCommands.DOUBLE_WIDTH_MASK) ? 16 : 32;
    }

    protected async unsetPrintMode(mask: number) {
        this.mayLog('unsetPrintMode called');

        this.printMode &= ~mask;
        this.mayTable({
            printMode: this.printMode,
        });

        await this.writePrintMode();

        this.adjustCharValues(this.printMode);
        // this.charHeight = (this.printMode & CharacterCommands.DOUBLE_HEIGHT_MASK) ? 48 : 24;
        // this.maxColumn = (this.printMode & CharacterCommands.DOUBLE_WIDTH_MASK) ? 16 : 32;
    }

    protected async writePrintMode() {
        this.mayLog('writePrintMode called');

        await this.writeBytes(AsciiCode.ESC, C('!'), this.printMode);
    }

    public async normal() {
        this.mayLog('normal called');

        this.printMode = 0;
        this.mayTable({
            printMode: this.printMode,
        });

        await this.writePrintMode();
    }

    public async inverseOn() {
        this.mayLog('inverseOn called');

        if (this.firmware >= 268) {
            await this.writeBytes(AsciiCode.GS, C('B'), 1);
        } else {
            await this.setPrintMode(CharacterCommands.INVERSE_MASK);
        }
    }

    public async inverseOff() {
        this.mayLog('inverseOff called');

        if (this.firmware >= 268) {
            await this.writeBytes(AsciiCode.GS, C('B'), 0);
        } else {
            await this.unsetPrintMode(CharacterCommands.INVERSE_MASK);
        }
    }

    public async upsideDownOn() {
        this.mayLog('upsideDownOn called');

        if (this.firmware >= 268) {
            await this.writeBytes(AsciiCode.ESC, C('{'), 1);
        } else {
            await this.setPrintMode(CharacterCommands.UPDOWN_MASK);
        }
    }

    public async upsideDownOff() {
        this.mayLog('upsideDownOff called');

        if (this.firmware >= 268) {
            await this.writeBytes(AsciiCode.ESC, C('{'), 0);
        } else {
            await this.unsetPrintMode(CharacterCommands.UPDOWN_MASK);
        }
    }

    public async doubleHeightOn() {
        this.mayLog('doubleHeightOn called');

        await this.setPrintMode(CharacterCommands.DOUBLE_HEIGHT_MASK);
    }

    public async doubleHeightOff() {
        this.mayLog('doubleHeightOff called');

        await this.unsetPrintMode(CharacterCommands.DOUBLE_HEIGHT_MASK);
    }

    public async doubleWidthOn() {
        this.mayLog('doubleWidthOn called');

        await this.setPrintMode(CharacterCommands.DOUBLE_WIDTH_MASK);
    }

    public async doubleWidthOff() {
        this.mayLog('doubleWidthOff called');

        await this.unsetPrintMode(CharacterCommands.DOUBLE_WIDTH_MASK);
    }

    public async strikeOn() {
        this.mayLog('strikeOn called');

        await this.setPrintMode(CharacterCommands.STRIKE_MASK);
    }

    public async strikeOff() {
        this.mayLog('strikeOff called');

        await this.unsetPrintMode(CharacterCommands.STRIKE_MASK);
    }

    public async boldOn() {
        this.mayLog('boldOn called');

        await this.setPrintMode(CharacterCommands.BOLD_MASK);
    }

    public async boldOff() {
        this.mayLog('boldOff called');

        await this.unsetPrintMode(CharacterCommands.BOLD_MASK);
    }

    public async justify(value: 'C' | 'L' | 'R' = 'L') {
        this.mayLog('justify called');

        let pos = 0;
        switch (value) {
            case 'C':
                pos = 1;
                break;
            case 'R':
                pos = 2;
                break;
            default:
                pos = 0;
                break;
        }

        await this.writeBytes(AsciiCode.ESC, C('a'), pos);
    }

    // Feeds by the specified number of lines
    public async feed(lines = 1) {
        this.mayLog('feed called');

        // Parameter validation
        z.number().int().min(1).parse(lines);

        let cLines = lines;
        if (this.firmware >= 264) {
            await this.writeBytes(AsciiCode.ESC, C('d'), cLines);
            this.timeoutSet(this.dotFeedTime * this.charHeight);

            this.prevByte = C('\n');
            this.column = 0;
            this.mayTable({
                prevByte: this.prevByte,
                column: this.column,
            });
        } else {
            while (cLines--) await this.write(C('\n')); // Feed manually; old firmware feeds excess lines
        }
    }

    public async feedRows(rows = 1) {
        this.mayLog('feedRows called');

        // Parameter validation
        z.number().int().min(1).parse(rows);

        await this.writeBytes(AsciiCode.ESC, C('J'), rows);
        this.timeoutSet(rows * this.dotFeedTime);

        this.prevByte = C('\n');
        this.column = 0;
        this.mayTable({
            prevByte: this.prevByte,
            column: this.column,
        });
    }

    public async flush() {
        this.mayLog('flush called');

        await this.writeBytes(AsciiCode.FF);
    }

    public async setSize(value: 'L' | 'M' | 'S' = 'S') {
        this.mayLog('setSize called');

        // let size;
        switch (value) {
            case 'M': // Medium: double height
                // size = 0x01;
                // this.charHeight = 48;
                // this.maxColumn = 32;
                await this.doubleHeightOn();
                await this.doubleWidthOff();
                break;
            case 'L': // Large: double width and height
                // size = 0x11;
                // this.charHeight = 48;
                // this.maxColumn = 16;
                await this.doubleHeightOn();
                await this.doubleWidthOn();
                break;
            default: // Small: standard width and height
                // size = 0x00;
                // this.charHeight = 24;
                // this.maxColumn = 32;
                await this.doubleWidthOff();
                await this.doubleHeightOff();
                break;
        }

        // this.writeBytes(AsciiCode.GS, c('!'), size);
        // this.prevByte = C('\n'); // Setting the size adds a linefeed
        // this.mayTable({
        //     prevByte: this.prevByte,
        // });
    }

    // ESC 7 n1 n2 n3 Setting Control Parameter Command
    // n1 = "max heating dots" 0-255 -- max number of thermal print head
    //      elements that will fire simultaneously.  Units = 8 dots (minus 1).
    //      Printer default is 7 (64 dots, or 1/6 of 384-dot width), this code
    //      sets it to 11 (96 dots, or 1/4 of width).
    // n2 = "heating time" 3-255 -- duration that heating dots are fired.
    //      Units = 10 us.  Printer default is 80 (800 us), this code sets it
    //      to value passed (default 120, or 1.2 ms -- a little longer than
    //      the default because we've increased the max heating dots).
    // n3 = "heating interval" 0-255 -- recovery time between groups of
    //      heating dots on line; possibly a function of power supply.
    //      Units = 10 us.  Printer default is 2 (20 us), this code sets it
    //      to 40 (throttled back due to 2A supply).
    // More heating dots = more peak current, but faster printing speed.
    // More heating time = darker print, but slower printing speed and
    // possibly paper 'stiction'.  More heating interval = clearer print,
    // but slower printing speed.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    public async setHeatConfig(dots = 11, time = 120, interval = 40) {
        throw new Error('Seems to be broken and is writing random characters');
        // this.mayLog('setHeatConfig called');

        // // Parameter validation
        // z.number().int().nonnegative().max(255).parse(dots);
        // z.number().int().min(3).max(255).parse(time);
        // z.number().int().nonnegative().max(255).parse(interval);

        // await this.writeBytes(AsciiCode.ESC, C('7')); // Esc 7 (print settings)
        // await this.writeBytes(dots, time, interval); // Heating dots, heat time, heat interval
    }

    // Print density description from manual:
    // DC2 # n Set printing density
    // D4..D0 of n is used to set the printing density.  Density is
    // 50% + 5% * n(D4-D0) printing density.
    // D7..D5 of n is used to set the printing break time.  Break time
    // is n(D7-D5)*250us.
    // (Unsure of the default value for either -- not documented)
    public async setPrintDensity(density = 10, breakTime = 2) {
        this.mayLog('setPrintDensity called');

        // Parameter validation
        z.number().int().nonnegative().max(31).parse(density);
        z.number().int().nonnegative().max(7).parse(breakTime);

        await this.writeBytes(AsciiCode.DC2, C('#'), (density << 5) | breakTime);
    }

    // Underlines of different weights can be produced:
    // 1 - normal underline
    // 2 - thick underline
    public async underlineOn(weight: 1 | 2 = 1) {
        this.mayLog('underlineOn called');

        await this.writeBytes(AsciiCode.ESC, C('-'), weight);
    }

    public async underlineOff() {
        this.mayLog('underlineOff called');

        await this.writeBytes(AsciiCode.ESC, C('-'), 0);
    }

    // Since mqtt is the most overhead in our chain we allow up to for bytes to be send at once. Every bulk function relaying on writeBytes should try to always fill up all 4
    // public async printBitmap(width: number, height: number, bitmap: number[]) {
    //     this.mayLog('printBitmap called');

    //     // Parameter validation
    //     z.number().int().nonnegative().max(384).parse(width);
    //     z.number().int().min(1).parse(height);
    //     z.array(z.number().int().nonnegative().max(255)).parse(bitmap);

    //     // eslint-disable-next-line unicorn/consistent-function-scoping
    //     const sendPayload = async ([first, ...rest]: number[]) => {
    //         await this.timeoutWait();
    //         await this.write(first, ...rest);
    //     };

    //     let chunkHeight;
    //     const rowBytes = Math.trunc(Math.ceil((width + 7) / 8)); // Round up to next byte boundary
    //     const rowBytesClipped = rowBytes >= 48 ? 48 : rowBytes; // 384 pixels max width
    //     let chunkHeightLimit = Math.trunc(256 / rowBytesClipped);
    //     let rowStart = 0;

    //     if (chunkHeightLimit > this.maxChunkHeight) {
    //         chunkHeightLimit = this.maxChunkHeight;
    //     } else if (chunkHeightLimit < 1) {
    //         chunkHeightLimit = 1;
    //     }

    //     for (let index = 0; rowStart < height; rowStart += chunkHeightLimit) {
    //         // Issue up to chunkHeightLimit rows at a time:
    //         chunkHeight = height - rowStart;
    //         if (chunkHeight > chunkHeightLimit) chunkHeight = chunkHeightLimit;

    //         await this.writeBytes(AsciiCode.DC2, C('*'), chunkHeight, rowBytesClipped);

    //         for (let y = 0; y < chunkHeight; y++) {
    //             let payload: number[] = [];

    //             for (let x = 0; x < rowBytesClipped; x++, index++) {
    //                 payload.push(bitmap[index]);

    //                 if (payload.length === 4) {
    //                     await sendPayload(payload);

    //                     payload = [];
    //                 }
    //             }

    //             // Check if payload has remaining elements
    //             if (payload.length > 0) {
    //                 await sendPayload(payload);
    //             }

    //             index += rowBytes - rowBytesClipped;
    //         }

    //         this.timeoutSet(chunkHeight * this.dotPrintTime);
    //     }

    //     this.prevByte = C('\n');
    //     this.mayTable({
    //         prevByte: this.prevByte,
    //     });
    // }

    // Take the printer offline. Print commands sent after this will be
    // ignored until 'online' is called.
    public async offline() {
        this.mayLog('offline called');

        await this.writeBytes(AsciiCode.ESC, C('='), 0);
    }

    // Take the printer back online. Subsequent print commands will be obeyed.
    public async online() {
        this.mayLog('online called');

        await this.writeBytes(AsciiCode.ESC, C('='), 1);
    }

    // Put the printer into a low-energy state immediately.
    public async sleep() {
        this.mayLog('sleep called');

        await this.sleepAfter(1); // Can't be 0, that means 'don't sleep'
    }

    // Put the printer into a low-energy state after the given number
    // of seconds.
    public async sleepAfter(seconds: number) {
        this.mayLog('sleepAfter called');

        // Parameter validation
        z.number().int().min(1).parse(seconds);

        if (this.firmware >= 264) {
            await this.writeBytes(AsciiCode.ESC, C('8'), seconds, seconds >> 8);
        } else {
            await this.writeBytes(AsciiCode.ESC, C('8'), seconds);
        }
    }

    // Wake the printer from a low-energy state.
    public async wake() {
        this.mayLog('wake called');

        this.timeoutSet(0); // Reset timeout counter

        await this.writeBytes(255); // Wake

        if (this.firmware >= 264) {
            await delay(50);
            await this.writeBytes(AsciiCode.ESC, C('8'), 0, 0); // Sleep off (important!)
        } else {
            // Datasheet recommends a 50 mS delay before issuing further commands,
            // but in practice this alone isn't sufficient (e.g. text size/style
            // commands may still be misinterpreted on wake).  A slightly longer
            // delay, interspersed with NUL chars (no-ops) seems to help.
            for (let index = 0; index < 10; index++) {
                await this.writeBytes(0);

                this.timeoutSet(10_000);
            }
        }
    }

    // Check the status of the paper using the printer's self reporting
    // ability.  Returns true for paper, false for no paper.
    // Might not work on all printers!
    // TODO:
    public async hasPaper() {
        this.mayLog('hasPaper called');

        throw new Error('Not implemented');
    }

    public async setLineHeight(value = 30) {
        this.mayLog('setLineHeight called');

        // Parameter validation
        z.number().int().min(24).parse(value);

        this.lineSpacing = value - 24;
        this.mayTable({
            lineSpacing: this.lineSpacing,
        });

        // The printer doesn't take into account the current text height
        // when setting line height, making this more akin to inter-line
        // spacing.  Default line spacing is 30 (char height of 24, line
        // spacing of 6).
        await this.writeBytes(AsciiCode.ESC, C('3'), value);
    }

    public setMaxChunkHeight(value = 256) {
        this.mayLog('setMaxChunkHeight called');

        // Parameter validation
        z.number().int().min(1).parse(value);

        this.maxChunkHeight = value;
        this.mayTable({
            maxChunkHeight: value,
        });
    }

    // These commands work only on printers w/recent firmware ------------------

    // Alters some chars in ASCII 0x23-0x7E range; see datasheet
    public async setCharset(value = 0) {
        this.mayLog('setCharset called');

        // Parameter validation
        z.number().int().nonnegative().max(15).parse(value);

        await this.writeBytes(AsciiCode.ESC, C('R'), value);
    }

    // Selects alt symbols for 'upper' ASCII values 0x80-0xFF
    public async setCodePage(value = 0) {
        this.mayLog('setCodePage called');

        // Parameter validation
        z.number().int().nonnegative().max(47).parse(value);

        await this.writeBytes(AsciiCode.ESC, C('t'), value);
    }

    public async tab() {
        this.mayLog('tab called');

        await this.writeBytes(AsciiCode.TAB);

        this.column = (this.column + 4) & 0b1111_1100;
        this.mayTable({
            column: this.column,
        });
    }

    public async setFont(font: 'A' | 'B' = 'A') {
        this.mayLog('setFont called');

        switch (font) {
            case 'B':
                await this.setPrintMode(CharacterCommands.FONT_MASK);
                break;
            default:
                await this.unsetPrintMode(CharacterCommands.FONT_MASK);
        }
    }

    public async setCharSpacing(spacing = 0) {
        this.mayLog('setCharSpacing called');

        // Parameter validation
        z.number().int().nonnegative().parse(spacing);

        await this.writeBytes(AsciiCode.ESC, C(' '), spacing);
    }

    // -------------------------------------------------------------------------
}
