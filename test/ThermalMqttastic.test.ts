/* eslint-disable jest/no-commented-out-tests */
/* eslint-disable unicorn/prevent-abbreviations */
/* eslint-disable id-length */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/dot-notation */
import type { AsyncMqttClient } from 'async-mqtt';
import { connectAsync } from 'async-mqtt';
import { mock } from 'jest-mock-extended';
import { ZodError } from 'zod';
import { ThermalMqttastic } from '../src';
import { delay } from '../src/util';

jest.mock('async-mqtt', () => ({
    connectAsync: jest.fn(() => mock<AsyncMqttClient>()),
}));

jest.mock('../src/util', () => ({
    delay: jest.fn(),
    C: jest.requireActual('../src/util').C,
}));

describe('ThermalMqttastic', () => {
    const mockLogger = mock<Console>();
    let thermalMqttastic: ThermalMqttastic;

    beforeEach(async () => {
        thermalMqttastic = new ThermalMqttastic({
            mqttUrl: 'mqtt://test',
            mqttOptions: { password: 'test' },
            logger: mockLogger,
        });

        await thermalMqttastic.begin();

        // to not count mock calls during init
        // the call counts are always referring to the counts of calls from the to test unit
        jest.clearAllMocks();

        jest.useFakeTimers().setSystemTime(new Date('2023-01-01'));
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('constructor', () => {
        it('should set additionalStackTimeout default', () => {
            expect(thermalMqttastic['additionalStackTimeout']).toBe(5);
        });

        it('should set additionalStackTimeout', () => {
            thermalMqttastic = new ThermalMqttastic({
                mqttUrl: 'mqtt://test',
                mqttOptions: { password: 'test' },
                logger: mockLogger,
                additionalStackTimeout: 30,
            });

            expect(thermalMqttastic['additionalStackTimeout']).toBe(30);
        });
    });

    describe('protected', () => {
        describe('mayLog', () => {
            it('should log when logger is provided', () => {
                thermalMqttastic['mayLog']('test');

                expect(mockLogger.log).toHaveBeenCalledWith('test');

                expect(mockLogger.log).toHaveBeenCalledTimes(1);
            });

            it('should not log when no logger is provided', () => {
                thermalMqttastic = new ThermalMqttastic({
                    mqttUrl: 'mqtt://test',
                    mqttOptions: { password: 'test' },
                });

                thermalMqttastic['mayLog']('test');

                expect(mockLogger.log).not.toHaveBeenCalled();
            });
        });

        describe('mayTable', () => {
            it('should table when logger is provided', () => {
                thermalMqttastic['mayTable']({ test: 'test' });

                expect(mockLogger.table).toHaveBeenCalledWith({ test: 'test' });

                expect(mockLogger.table).toHaveBeenCalledTimes(1);
            });

            it('should not table when no logger is provided', () => {
                thermalMqttastic = new ThermalMqttastic({
                    mqttUrl: 'mqtt://test',
                    mqttOptions: { password: 'test' },
                });

                thermalMqttastic['mayTable']({ test: 'test' });

                expect(mockLogger.table).not.toHaveBeenCalled();
            });
        });

        describe('getByteTime', () => {
            it('should get default byte time', () => {
                expect(thermalMqttastic['getByteTime']()).toBe(5_000_574);
            });

            it('should get and apply modifier to default byte time', () => {
                expect(thermalMqttastic['getByteTime'](3)).toBe(5_001_722);
            });
        });

        describe('publish', () => {
            it('should publish topic', async () => {
                expect.assertions(2);

                await thermalMqttastic['publish']('test', 'payload');

                expect(thermalMqttastic['mqttClient']?.publish).toHaveBeenCalledWith(
                    'test',
                    'payload',
                    { qos: 2 },
                );

                expect(thermalMqttastic['mqttClient']?.publish).toHaveBeenCalledTimes(1);
            });

            it('should throw when no client is initialized', async () => {
                expect.assertions(2);

                thermalMqttastic = new ThermalMqttastic({
                    mqttUrl: 'mqtt://test',
                    mqttOptions: { password: 'test' },
                });

                await expect(thermalMqttastic['publish']('test', 'payload')).rejects.toThrow(Error);

                expect(thermalMqttastic['mqttClient']).toBeUndefined();
            });
        });

        describe('timeoutSet', () => {
            it('should set timeout', async () => {
                expect.assertions(6);

                const resumeTime = Date.now() + 5;

                thermalMqttastic['timeoutSet'](5_000_000);

                expect(mockLogger.log).toHaveBeenCalledWith('timeoutSet called');

                expect(thermalMqttastic['resumeTime']).toBe(resumeTime);

                expect(mockLogger.log).toHaveBeenCalledWith('Timeout set to 5');
                expect(mockLogger.table).toHaveBeenCalledWith({
                    resumeTime,
                });

                expect(mockLogger.log).toHaveBeenCalledTimes(2);
                expect(mockLogger.table).toHaveBeenCalledTimes(1);
            });
        });

        describe('timeoutWait', () => {
            it('should wait timeout', async () => {
                expect.assertions(5);

                thermalMqttastic['resumeTime'] = Date.now() + 5;

                await thermalMqttastic['timeoutWait']();

                expect(mockLogger.log).toHaveBeenCalledWith('timeoutWait called');

                expect(mockLogger.log).toHaveBeenCalledWith('Delay for 5ms');

                expect(delay).toHaveBeenCalledWith(5);

                expect(mockLogger.log).toHaveBeenCalledTimes(2);
                expect(delay).toHaveBeenCalledTimes(1);
            });
        });

        describe('writeBytes', () => {
            it('should write bytes', async () => {
                expect.assertions(11);

                const timeoutWaitSpy = jest
                    .spyOn(thermalMqttastic as any, 'timeoutWait')
                    .mockImplementation(() => {});
                const publishSpy = jest
                    .spyOn(thermalMqttastic as any, 'publish')
                    .mockImplementation(() => {});
                const getByteTimeSpy = jest
                    .spyOn(thermalMqttastic as any, 'getByteTime')
                    .mockImplementation(() => 3);
                const timeoutSetSpy = jest
                    .spyOn(thermalMqttastic as any, 'timeoutSet')
                    .mockImplementation(() => {});

                await thermalMqttastic['writeBytes'](12, 13);

                expect(mockLogger.log).toHaveBeenCalledWith('writeBytes called');

                expect(timeoutWaitSpy).toHaveBeenCalledWith();

                expect(publishSpy).toHaveBeenCalledWith('writeBytes', '12,13');

                expect(mockLogger.log).toHaveBeenCalledWith('Written 12,13 to stream (writeBytes)');

                expect(getByteTimeSpy).toHaveBeenCalledWith(2);

                expect(timeoutSetSpy).toHaveBeenCalledWith(3);

                expect(mockLogger.log).toHaveBeenCalledTimes(2);
                expect(timeoutWaitSpy).toHaveBeenCalledTimes(1);
                expect(publishSpy).toHaveBeenCalledTimes(1);
                expect(getByteTimeSpy).toHaveBeenCalledTimes(1);
                expect(timeoutSetSpy).toHaveBeenCalledTimes(1);
            });
        });

        describe('write', () => {
            let timeoutWaitSpy: jest.SpyInstance;
            let publishSpy: jest.SpyInstance;
            let getByteTimeSpy: jest.SpyInstance;
            let timeoutSetSpy: jest.SpyInstance;

            const expectPayload = (
                temporaryByteTime = 0,
                ...payload: [number, number?, number?, number?]
            ) => {
                const payloadString = payload.join(',');

                expect(timeoutWaitSpy).toHaveBeenCalledWith();

                expect(publishSpy).toHaveBeenCalledWith('write', payloadString);

                expect(mockLogger.log).toHaveBeenCalledWith(
                    `Written ${payloadString} to stream (write)`,
                );

                expect(getByteTimeSpy).toHaveBeenCalledWith(payload.length);

                expect(timeoutSetSpy).toHaveBeenCalledWith(3 + temporaryByteTime);
            };

            beforeEach(() => {
                timeoutWaitSpy = jest
                    .spyOn(thermalMqttastic as any, 'timeoutWait')
                    .mockImplementation(() => {});
                publishSpy = jest
                    .spyOn(thermalMqttastic as any, 'publish')
                    .mockImplementation(() => {});
                getByteTimeSpy = jest
                    .spyOn(thermalMqttastic as any, 'getByteTime')
                    .mockImplementation(() => 3);
                timeoutSetSpy = jest
                    .spyOn(thermalMqttastic as any, 'timeoutSet')
                    .mockImplementation(() => {});
            });

            it('should write bytes', async () => {
                expect.assertions(12);

                await thermalMqttastic['write'](12, 14);

                // expect(columnSetSpy).toHaveBeenCalledWith(1);
                // expect(prevByteSetSpy).toHaveBeenCalledWith(12);
                expect(mockLogger.table).toHaveBeenCalledWith({
                    column: 1,
                    prevByte: 12,
                });

                // expect(columnSetSpy).toHaveBeenCalledWith(2);
                // expect(prevByteSetSpy).toHaveBeenCalledWith(14);
                expect(mockLogger.table).toHaveBeenCalledWith({
                    column: 2,
                    prevByte: 14,
                });

                expectPayload(0, 12, 14);

                expect(mockLogger.log).toHaveBeenCalledTimes(2);
                expect(timeoutWaitSpy).toHaveBeenCalledTimes(1);
                expect(publishSpy).toHaveBeenCalledTimes(1);
                expect(getByteTimeSpy).toHaveBeenCalledTimes(1);
                expect(timeoutSetSpy).toHaveBeenCalledTimes(1);
            });

            it('should write only certain bytes', async () => {
                expect.assertions(12);

                await thermalMqttastic['write'](12, 14, undefined, 13);

                expect(mockLogger.table).toHaveBeenCalledWith({
                    column: 1,
                    prevByte: 12,
                });

                expect(mockLogger.table).toHaveBeenCalledWith({
                    column: 2,
                    prevByte: 14,
                });

                expectPayload(0, 12, 14);

                expect(mockLogger.log).toHaveBeenCalledTimes(2);
                expect(timeoutWaitSpy).toHaveBeenCalledTimes(1);
                expect(publishSpy).toHaveBeenCalledTimes(1);
                expect(getByteTimeSpy).toHaveBeenCalledTimes(1);
                expect(timeoutSetSpy).toHaveBeenCalledTimes(1);
            });

            it('should split write chunks by line breaks', async () => {
                expect.assertions(19);

                await thermalMqttastic['write'](12, 14, 10, 15);

                expect(mockLogger.table).toHaveBeenCalledWith({
                    column: 1,
                    prevByte: 12,
                });
                expect(mockLogger.table).toHaveBeenCalledWith({
                    column: 2,
                    prevByte: 14,
                });

                expect(mockLogger.table).toHaveBeenCalledWith({
                    column: 0,
                    prevByte: 10,
                });

                expectPayload(0, 12, 14, 10);

                expect(mockLogger.table).toHaveBeenCalledWith({
                    column: 1,
                    prevByte: 15,
                });

                expectPayload(732_600, 15);

                expect(mockLogger.log).toHaveBeenCalledTimes(3);
                expect(timeoutWaitSpy).toHaveBeenCalledTimes(2);
                expect(publishSpy).toHaveBeenCalledTimes(2);
                expect(getByteTimeSpy).toHaveBeenCalledTimes(2);
                expect(timeoutSetSpy).toHaveBeenCalledTimes(2);
            });

            it('should split write chunks when colum max is hit', async () => {
                expect.assertions(18);

                thermalMqttastic['column'] = 31; // fake almost full colum

                await thermalMqttastic['write'](12, 14);

                expect(mockLogger.table).toHaveBeenCalledWith({
                    column: 32,
                    prevByte: 12,
                });

                expect(mockLogger.table).toHaveBeenCalledWith({
                    column: 0,
                    prevByte: 10,
                });

                expectPayload(732_600, 12, 10);

                expect(mockLogger.table).toHaveBeenCalledWith({
                    column: 1,
                    prevByte: 14,
                });

                expectPayload(0, 14);

                expect(mockLogger.log).toHaveBeenCalledTimes(3);
                expect(timeoutWaitSpy).toHaveBeenCalledTimes(2);
                expect(publishSpy).toHaveBeenCalledTimes(2);
                expect(getByteTimeSpy).toHaveBeenCalledTimes(2);
                expect(timeoutSetSpy).toHaveBeenCalledTimes(2);
            });

            it('should wait additional time when previous byte is line break', async () => {
                expect.assertions(17);

                await thermalMqttastic['write'](10, 10);

                expect(mockLogger.table).toHaveBeenCalledWith({
                    column: 0,
                    prevByte: 10,
                });

                expectPayload(63_000, 10);

                expect(mockLogger.table).toHaveBeenCalledWith({
                    column: 0,
                    prevByte: 10,
                });

                expectPayload(63_000, 10);

                expect(mockLogger.log).toHaveBeenCalledTimes(3);
                expect(timeoutWaitSpy).toHaveBeenCalledTimes(2);
                expect(publishSpy).toHaveBeenCalledTimes(2);
                expect(getByteTimeSpy).toHaveBeenCalledTimes(2);
                expect(timeoutSetSpy).toHaveBeenCalledTimes(2);
            });
        });

        describe('adjustCharValues', () => {
            it('should adjust character values for font B', async () => {
                expect.assertions(6);

                thermalMqttastic['adjustCharValues'](1);

                expect(mockLogger.log).toHaveBeenCalledWith('adjustCharValues called');

                expect(thermalMqttastic['charHeight']).toBe(17);
                expect(thermalMqttastic['maxColumn']).toBe(42);
                expect(mockLogger.table).toHaveBeenCalledWith({
                    charHeight: 17,
                    maxColumn: 42,
                });

                expect(mockLogger.log).toHaveBeenCalledTimes(1);
                expect(mockLogger.table).toHaveBeenCalledTimes(1);
            });

            it('should adjust character values for font B and double width mode', async () => {
                expect.assertions(6);

                thermalMqttastic['adjustCharValues'](33);

                expect(mockLogger.log).toHaveBeenCalledWith('adjustCharValues called');

                expect(thermalMqttastic['charHeight']).toBe(17);
                expect(thermalMqttastic['maxColumn']).toBe(21);
                expect(mockLogger.table).toHaveBeenCalledWith({
                    charHeight: 17,
                    maxColumn: 21,
                });

                expect(mockLogger.log).toHaveBeenCalledTimes(1);
                expect(mockLogger.table).toHaveBeenCalledTimes(1);
            });

            it('should adjust character values for font B and double height mode', async () => {
                expect.assertions(6);

                thermalMqttastic['adjustCharValues'](17);

                expect(mockLogger.log).toHaveBeenCalledWith('adjustCharValues called');

                expect(thermalMqttastic['charHeight']).toBe(34);
                expect(thermalMqttastic['maxColumn']).toBe(42);
                expect(mockLogger.table).toHaveBeenCalledWith({
                    charHeight: 34,
                    maxColumn: 42,
                });

                expect(mockLogger.log).toHaveBeenCalledTimes(1);
                expect(mockLogger.table).toHaveBeenCalledTimes(1);
            });

            it('should adjust character values for font A', async () => {
                expect.assertions(6);

                thermalMqttastic['adjustCharValues'](0);

                expect(mockLogger.log).toHaveBeenCalledWith('adjustCharValues called');

                expect(thermalMqttastic['charHeight']).toBe(24);
                expect(thermalMqttastic['maxColumn']).toBe(32);
                expect(mockLogger.table).toHaveBeenCalledWith({
                    charHeight: 24,
                    maxColumn: 32,
                });

                expect(mockLogger.log).toHaveBeenCalledTimes(1);
                expect(mockLogger.table).toHaveBeenCalledTimes(1);
            });

            it('should adjust character values for font A and double width mode', async () => {
                expect.assertions(6);

                thermalMqttastic['adjustCharValues'](32);

                expect(mockLogger.log).toHaveBeenCalledWith('adjustCharValues called');

                expect(thermalMqttastic['charHeight']).toBe(24);
                expect(thermalMqttastic['maxColumn']).toBe(16);
                expect(mockLogger.table).toHaveBeenCalledWith({
                    charHeight: 24,
                    maxColumn: 16,
                });

                expect(mockLogger.log).toHaveBeenCalledTimes(1);
                expect(mockLogger.table).toHaveBeenCalledTimes(1);
            });

            it('should adjust character values for font A and double height mode', async () => {
                expect.assertions(6);

                thermalMqttastic['adjustCharValues'](16);

                expect(mockLogger.log).toHaveBeenCalledWith('adjustCharValues called');

                expect(thermalMqttastic['charHeight']).toBe(48);
                expect(thermalMqttastic['maxColumn']).toBe(32);
                expect(mockLogger.table).toHaveBeenCalledWith({
                    charHeight: 48,
                    maxColumn: 32,
                });

                expect(mockLogger.log).toHaveBeenCalledTimes(1);
                expect(mockLogger.table).toHaveBeenCalledTimes(1);
            });
        });

        describe('setPrintMode', () => {
            it('should set print mode', async () => {
                expect.assertions(9);

                thermalMqttastic['printMode'] = 5; // Not a actual value. Just want to force bitwise

                const writePrintModeSpy = jest
                    .spyOn(thermalMqttastic as any, 'writePrintMode')
                    .mockImplementation(() => {});
                const adjustCharValuesSpy = jest
                    .spyOn(thermalMqttastic as any, 'adjustCharValues')
                    .mockImplementation(() => {});

                await thermalMqttastic['setPrintMode'](3);

                expect(mockLogger.log).toHaveBeenCalledWith('setPrintMode called');

                expect(thermalMqttastic['printMode']).toBe(7);
                expect(mockLogger.table).toHaveBeenCalledWith({
                    printMode: 7,
                });

                expect(writePrintModeSpy).toHaveBeenCalledWith();

                expect(adjustCharValuesSpy).toHaveBeenCalledWith(7);

                expect(mockLogger.log).toHaveBeenCalledTimes(1);
                expect(mockLogger.table).toHaveBeenCalledTimes(1);
                expect(writePrintModeSpy).toHaveBeenCalledTimes(1);
                expect(adjustCharValuesSpy).toHaveBeenCalledTimes(1);
            });
        });

        describe('unsetPrintMode', () => {
            it('should unset print mode', async () => {
                expect.assertions(9);

                thermalMqttastic['printMode'] = 7; // Not a actual value. Just want to force bitwise

                const writePrintModeSpy = jest
                    .spyOn(thermalMqttastic as any, 'writePrintMode')
                    .mockImplementation(() => {});
                const adjustCharValuesSpy = jest
                    .spyOn(thermalMqttastic as any, 'adjustCharValues')
                    .mockImplementation(() => {});

                await thermalMqttastic['unsetPrintMode'](3);

                expect(mockLogger.log).toHaveBeenCalledWith('unsetPrintMode called');

                expect(thermalMqttastic['printMode']).toBe(4);
                expect(mockLogger.table).toHaveBeenCalledWith({
                    printMode: 4,
                });

                expect(writePrintModeSpy).toHaveBeenCalledWith();

                expect(adjustCharValuesSpy).toHaveBeenCalledWith(4);

                expect(mockLogger.log).toHaveBeenCalledTimes(1);
                expect(mockLogger.table).toHaveBeenCalledTimes(1);
                expect(writePrintModeSpy).toHaveBeenCalledTimes(1);
                expect(adjustCharValuesSpy).toHaveBeenCalledTimes(1);
            });
        });

        describe('writePrintMode', () => {
            it('should write print mode', async () => {
                expect.assertions(4);

                thermalMqttastic['printMode'] = 2; // Not a actual value. Just want to force bitwise

                const writeBytesSpy = jest
                    .spyOn(thermalMqttastic as any, 'writeBytes')
                    .mockImplementation(() => {});

                await thermalMqttastic['writePrintMode']();

                expect(mockLogger.log).toHaveBeenCalledWith('writePrintMode called');

                expect(writeBytesSpy).toHaveBeenCalledWith(27, 33, 2);

                expect(mockLogger.log).toHaveBeenCalledTimes(1);
                expect(writeBytesSpy).toHaveBeenCalledTimes(1);
            });
        });
    });

    describe('setTimes', () => {
        it('should set new times', () => {
            thermalMqttastic.setTimes(12, 13);

            expect(mockLogger.log).toHaveBeenCalledWith('setTimes called');

            expect(thermalMqttastic['dotPrintTime']).toBe(12);
            expect(thermalMqttastic['dotFeedTime']).toBe(13);
            expect(mockLogger.table).toHaveBeenCalledWith({
                dotPrintTime: 12,
                dotFeedTime: 13,
            });

            expect(mockLogger.log).toHaveBeenCalledTimes(1);
        });

        it('should validate the dotPrintTime parameter', () => {
            expect(() => thermalMqttastic.setTimes(12.1, 13)).toThrow(ZodError);
            expect(() => thermalMqttastic.setTimes(-12, 13)).toThrow(ZodError);
        });

        it('should validate the dotFeedTime parameter', () => {
            expect(() => thermalMqttastic.setTimes(12, 13.1)).toThrow(ZodError);
            expect(() => thermalMqttastic.setTimes(12, -13)).toThrow(ZodError);
        });
    });

    describe('print', () => {
        it('should print text', async () => {
            expect.assertions(7);

            const writeSpy = jest
                .spyOn(thermalMqttastic as any, 'write')
                .mockImplementation(() => {});

            await thermalMqttastic.print('abcdef');

            expect(mockLogger.log).toHaveBeenCalledWith('print called');

            expect(mockLogger.log).toHaveBeenCalledWith('Splitted in chunks of abcd,ef');

            expect(writeSpy).toHaveBeenCalledWith(97, 98, 99, 100);
            expect(writeSpy).toHaveBeenCalledWith(101, 102);

            expect(mockLogger.log).toHaveBeenCalledWith('Printed abcdef');

            expect(mockLogger.log).toHaveBeenCalledTimes(3);
            expect(writeSpy).toHaveBeenCalledTimes(2);
        });

        // Not a real life scenario
        it('should throw when split fails', async () => {
            expect.assertions(4);

            const writeSpy = jest
                .spyOn(thermalMqttastic as any, 'write')
                .mockImplementation(() => {});

            await expect(thermalMqttastic.print('')).rejects.toThrow(Error);

            expect(mockLogger.log).toHaveBeenCalledWith('print called');

            expect(mockLogger.log).toHaveBeenCalledTimes(1);
            expect(writeSpy).not.toHaveBeenCalled();
        });
    });

    describe('println', () => {
        it('should print text and feed line', async () => {
            expect.assertions(6);

            const printSpy = jest
                .spyOn(thermalMqttastic as any, 'print')
                .mockImplementation(() => {});
            const writeSpy = jest
                .spyOn(thermalMqttastic as any, 'write')
                .mockImplementation(() => {});

            await thermalMqttastic.println('abcdef');

            expect(mockLogger.log).toHaveBeenCalledWith('println called');

            expect(printSpy).toHaveBeenCalledWith('abcdef');
            expect(writeSpy).toHaveBeenCalledWith(13, 10);

            expect(mockLogger.log).toHaveBeenCalledTimes(1);
            expect(printSpy).toHaveBeenCalledTimes(1);
            expect(writeSpy).toHaveBeenCalledTimes(1);
        });
    });

    describe('begin', () => {
        it('should initialize mqtt, the printer and set default values', async () => {
            expect.assertions(18);

            const timeoutSetSpy = jest
                .spyOn(thermalMqttastic as any, 'timeoutSet')
                .mockImplementation(() => {});
            const wakeSpy = jest
                .spyOn(thermalMqttastic as any, 'wake')
                .mockImplementation(() => {});
            const resetSpy = jest
                .spyOn(thermalMqttastic as any, 'reset')
                .mockImplementation(() => {});

            await thermalMqttastic.begin();

            expect(mockLogger.log).toHaveBeenCalledWith('begin called');

            expect(mockLogger.log).toHaveBeenCalledWith('Connecting to MQTT');
            expect(connectAsync).toHaveBeenCalledWith('mqtt://test', {
                password: 'test',
            });
            expect(mockLogger.log).toHaveBeenCalledWith('MQTT connection successful');

            expect(thermalMqttastic['firmware']).toBe(268);
            expect(mockLogger.table).toHaveBeenCalledWith({
                firmware: 268,
            });

            expect(timeoutSetSpy).toHaveBeenCalledWith(2_000_000);

            expect(wakeSpy).toHaveBeenCalledWith();

            expect(resetSpy).toHaveBeenCalledWith();

            expect(thermalMqttastic['dotPrintTime']).toBe(30_000);
            expect(thermalMqttastic['dotFeedTime']).toBe(2_100);
            expect(thermalMqttastic['maxChunkHeight']).toBe(255);
            expect(mockLogger.table).toHaveBeenCalledWith({
                dotPrintTime: 30_000,
                dotFeedTime: 2_100,
                maxChunkHeight: 255,
            });

            expect(mockLogger.log).toHaveBeenCalledTimes(3);
            expect(mockLogger.table).toHaveBeenCalledTimes(2);
            expect(timeoutSetSpy).toHaveBeenCalledTimes(1);
            expect(wakeSpy).toHaveBeenCalledTimes(1);
            expect(resetSpy).toHaveBeenCalledTimes(1);
        });

        it('should validate the firmware parameter', async () => {
            expect.assertions(2);

            await expect(thermalMqttastic.begin(-1)).rejects.toThrow(ZodError);
            await expect(thermalMqttastic.begin(1.1)).rejects.toThrow(ZodError);
        });
    });

    describe('reset', () => {
        it('should reset the printer', async () => {
            expect.assertions(12);

            // fake early firmware
            await thermalMqttastic.begin(12);

            // to not count mock calls during init
            jest.clearAllMocks();

            const writeBytesSpy = jest
                .spyOn(thermalMqttastic as any, 'writeBytes')
                .mockImplementation(() => {});

            await thermalMqttastic.reset();

            expect(mockLogger.log).toHaveBeenCalledWith('reset called');

            expect(writeBytesSpy).toHaveBeenCalledWith(27, 64);

            expect(thermalMqttastic['prevByte']).toBe(10);
            expect(thermalMqttastic['column']).toBe(0);
            expect(thermalMqttastic['maxColumn']).toBe(32);
            expect(thermalMqttastic['charHeight']).toBe(24);
            expect(thermalMqttastic['lineSpacing']).toBe(6);
            expect(thermalMqttastic['barcodeHeight']).toBe(50);
            expect(mockLogger.table).toHaveBeenCalledWith({
                prevByte: 10,
                column: 0,
                maxColumn: 32,
                charHeight: 24,
                lineSpacing: 6,
                barcodeHeight: 50,
            });

            expect(mockLogger.log).toHaveBeenCalledTimes(1);
            expect(mockLogger.table).toHaveBeenCalledTimes(1);
            expect(writeBytesSpy).toHaveBeenCalledTimes(1);
        });

        it('should reset the printer with additional bytes when newer firmware', async () => {
            expect.assertions(15);

            const writeBytesSpy = jest
                .spyOn(thermalMqttastic as any, 'writeBytes')
                .mockImplementation(() => {});

            await thermalMqttastic.reset();

            expect(mockLogger.log).toHaveBeenCalledWith('reset called');

            expect(writeBytesSpy).toHaveBeenCalledWith(27, 64);

            expect(thermalMqttastic['prevByte']).toBe(10);
            expect(thermalMqttastic['column']).toBe(0);
            expect(thermalMqttastic['maxColumn']).toBe(32);
            expect(thermalMqttastic['charHeight']).toBe(24);
            expect(thermalMqttastic['lineSpacing']).toBe(6);
            expect(thermalMqttastic['barcodeHeight']).toBe(50);
            expect(mockLogger.table).toHaveBeenCalledWith({
                prevByte: 10,
                column: 0,
                maxColumn: 32,
                charHeight: 24,
                lineSpacing: 6,
                barcodeHeight: 50,
            });

            expect(writeBytesSpy).toHaveBeenCalledWith(27, 68);
            expect(writeBytesSpy).toHaveBeenCalledWith(4, 8, 12, 16);
            expect(writeBytesSpy).toHaveBeenCalledWith(20, 24, 28, 0);

            expect(mockLogger.log).toHaveBeenCalledTimes(1);
            expect(mockLogger.table).toHaveBeenCalledTimes(1);
            expect(writeBytesSpy).toHaveBeenCalledTimes(4);
        });
    });

    describe('setDefaults', () => {
        it('should call all default functions', async () => {
            expect.assertions(24);

            const onlineSpy = jest
                .spyOn(thermalMqttastic as any, 'online')
                .mockImplementation(() => {});
            const justifySpy = jest
                .spyOn(thermalMqttastic as any, 'justify')
                .mockImplementation(() => {});
            const inverseOffSpy = jest
                .spyOn(thermalMqttastic as any, 'inverseOff')
                .mockImplementation(() => {});
            const doubleHeightOffSpy = jest
                .spyOn(thermalMqttastic as any, 'doubleHeightOff')
                .mockImplementation(() => {});
            const setLineHeightSpy = jest
                .spyOn(thermalMqttastic as any, 'setLineHeight')
                .mockImplementation(() => {});
            const boldOffSpy = jest
                .spyOn(thermalMqttastic as any, 'boldOff')
                .mockImplementation(() => {});
            const underlineOffSpy = jest
                .spyOn(thermalMqttastic as any, 'underlineOff')
                .mockImplementation(() => {});
            const setBarcodeHeightSpy = jest
                .spyOn(thermalMqttastic as any, 'setBarcodeHeight')
                .mockImplementation(() => {});
            const setSizeSpy = jest
                .spyOn(thermalMqttastic as any, 'setSize')
                .mockImplementation(() => {});
            const setCharsetSpy = jest
                .spyOn(thermalMqttastic as any, 'setCharset')
                .mockImplementation(() => {});
            const setCodePageSpy = jest
                .spyOn(thermalMqttastic as any, 'setCodePage')
                .mockImplementation(() => {});

            await thermalMqttastic.setDefaults();

            expect(mockLogger.log).toHaveBeenCalledWith('setDefaults called');

            expect(onlineSpy).toHaveBeenCalledWith();
            expect(justifySpy).toHaveBeenCalledWith();
            expect(inverseOffSpy).toHaveBeenCalledWith();
            expect(doubleHeightOffSpy).toHaveBeenCalledWith();
            expect(setLineHeightSpy).toHaveBeenCalledWith();
            expect(boldOffSpy).toHaveBeenCalledWith();
            expect(underlineOffSpy).toHaveBeenCalledWith();
            expect(setBarcodeHeightSpy).toHaveBeenCalledWith();
            expect(setSizeSpy).toHaveBeenCalledWith();
            expect(setCharsetSpy).toHaveBeenCalledWith();
            expect(setCodePageSpy).toHaveBeenCalledWith();

            expect(mockLogger.log).toHaveBeenCalledTimes(1);
            expect(onlineSpy).toHaveBeenCalledTimes(1);
            expect(justifySpy).toHaveBeenCalledTimes(1);
            expect(inverseOffSpy).toHaveBeenCalledTimes(1);
            expect(doubleHeightOffSpy).toHaveBeenCalledTimes(1);
            expect(setLineHeightSpy).toHaveBeenCalledTimes(1);
            expect(boldOffSpy).toHaveBeenCalledTimes(1);
            expect(underlineOffSpy).toHaveBeenCalledTimes(1);
            expect(setBarcodeHeightSpy).toHaveBeenCalledTimes(1);
            expect(setSizeSpy).toHaveBeenCalledTimes(1);
            expect(setCharsetSpy).toHaveBeenCalledTimes(1);
            expect(setCodePageSpy).toHaveBeenCalledTimes(1);
        });
    });

    describe('test', () => {
        it('should print test', async () => {
            expect.assertions(6);

            const printlnSpy = jest
                .spyOn(thermalMqttastic as any, 'println')
                .mockImplementation(() => {});
            const feedSpy = jest
                .spyOn(thermalMqttastic as any, 'feed')
                .mockImplementation(() => {});

            await thermalMqttastic.test();

            expect(mockLogger.log).toHaveBeenCalledWith('test called');

            expect(printlnSpy).toHaveBeenCalledWith('Hello World!');
            expect(feedSpy).toHaveBeenCalledWith(2);

            expect(mockLogger.log).toHaveBeenCalledTimes(1);
            expect(printlnSpy).toHaveBeenCalledTimes(1);
            expect(feedSpy).toHaveBeenCalledTimes(1);
        });
    });

    describe('testPage', () => {
        it('should print testPage', async () => {
            expect.assertions(6);

            const writeBytesSpy = jest
                .spyOn(thermalMqttastic as any, 'writeBytes')
                .mockImplementation(() => {});
            const timeoutSetSpy = jest
                .spyOn(thermalMqttastic as any, 'timeoutSet')
                .mockImplementation(() => {});

            await thermalMqttastic.testPage();

            expect(mockLogger.log).toHaveBeenCalledWith('testPage called');

            expect(writeBytesSpy).toHaveBeenCalledWith(18, 84);
            expect(timeoutSetSpy).toHaveBeenCalledWith(19_110_600);

            expect(mockLogger.log).toHaveBeenCalledTimes(1);
            expect(writeBytesSpy).toHaveBeenCalledTimes(1);
            expect(timeoutSetSpy).toHaveBeenCalledTimes(1);
        });
    });

    describe('setBarcodeHeight', () => {
        it('should set barcode height default', async () => {
            expect.assertions(7);

            const writeBytesSpy = jest
                .spyOn(thermalMqttastic as any, 'writeBytes')
                .mockImplementation(() => {});

            await thermalMqttastic.setBarcodeHeight();

            expect(mockLogger.log).toHaveBeenCalledWith('setBarcodeHeight called');

            expect(thermalMqttastic['barcodeHeight']).toBe(50);
            expect(mockLogger.table).toHaveBeenCalledWith({
                barcodeHeight: 50,
            });

            expect(writeBytesSpy).toHaveBeenCalledWith(29, 104, 50);

            expect(mockLogger.log).toHaveBeenCalledTimes(1);
            expect(mockLogger.table).toHaveBeenCalledTimes(1);
            expect(writeBytesSpy).toHaveBeenCalledTimes(1);
        });

        it('should set barcode height', async () => {
            expect.assertions(7);

            const writeBytesSpy = jest
                .spyOn(thermalMqttastic as any, 'writeBytes')
                .mockImplementation(() => {});

            await thermalMqttastic.setBarcodeHeight(23);

            expect(mockLogger.log).toHaveBeenCalledWith('setBarcodeHeight called');

            expect(thermalMqttastic['barcodeHeight']).toBe(23);
            expect(mockLogger.table).toHaveBeenCalledWith({
                barcodeHeight: 23,
            });

            expect(writeBytesSpy).toHaveBeenCalledWith(29, 104, 23);

            expect(mockLogger.log).toHaveBeenCalledTimes(1);
            expect(mockLogger.table).toHaveBeenCalledTimes(1);
            expect(writeBytesSpy).toHaveBeenCalledTimes(1);
        });

        it('should validate the barcodeHeight parameter', async () => {
            expect.assertions(2);

            await expect(thermalMqttastic.setBarcodeHeight(13.1)).rejects.toThrow(ZodError);
            await expect(thermalMqttastic.setBarcodeHeight(-13)).rejects.toThrow(ZodError);
        });
    });

    describe('printBarcode', () => {
        let feedSpy: jest.SpyInstance;
        let writeBytesSpy: jest.SpyInstance;
        let timeoutSetSpy: jest.SpyInstance;

        beforeEach(() => {
            feedSpy = jest.spyOn(thermalMqttastic as any, 'feed').mockImplementation(() => {});
            writeBytesSpy = jest
                .spyOn(thermalMqttastic as any, 'writeBytes')
                .mockImplementation(() => {});
            timeoutSetSpy = jest
                .spyOn(thermalMqttastic as any, 'timeoutSet')
                .mockImplementation(() => {});
        });
        it('should print a barcode on old firmware', async () => {
            expect.assertions(19);

            // fake early firmware
            await thermalMqttastic.begin(12);

            // to not count mock calls during init
            jest.clearAllMocks();

            await thermalMqttastic.printBarcode('abcde', 8);

            expect(mockLogger.log).toHaveBeenCalledWith('printBarcode called');

            expect(feedSpy).toHaveBeenCalledWith(1);

            expect(writeBytesSpy).toHaveBeenCalledWith(29, 72, 2);
            expect(writeBytesSpy).toHaveBeenCalledWith(29, 119, 3);
            expect(writeBytesSpy).toHaveBeenCalledWith(29, 107, 8);

            expect(writeBytesSpy).toHaveBeenCalledWith(97);
            expect(writeBytesSpy).toHaveBeenCalledWith(98);
            expect(writeBytesSpy).toHaveBeenCalledWith(99);
            expect(writeBytesSpy).toHaveBeenCalledWith(100);
            expect(writeBytesSpy).toHaveBeenCalledWith(101);
            expect(writeBytesSpy).toHaveBeenCalledWith(0);

            expect(timeoutSetSpy).toHaveBeenCalledWith(2_700_000);

            expect(thermalMqttastic['prevByte']).toBe(10);
            expect(mockLogger.table).toHaveBeenCalledWith({
                prevByte: 10,
            });

            expect(mockLogger.log).toHaveBeenCalledTimes(1);
            expect(mockLogger.table).toHaveBeenCalledTimes(1);
            expect(feedSpy).toHaveBeenCalledTimes(1);
            expect(writeBytesSpy).toHaveBeenCalledTimes(9);
            expect(timeoutSetSpy).toHaveBeenCalledTimes(1);
        });

        it('should print a barcode on new firmware', async () => {
            expect.assertions(19);

            await thermalMqttastic.printBarcode('abcde', 8);

            expect(mockLogger.log).toHaveBeenCalledWith('printBarcode called');

            expect(feedSpy).toHaveBeenCalledWith(1);

            expect(writeBytesSpy).toHaveBeenCalledWith(29, 72, 2);
            expect(writeBytesSpy).toHaveBeenCalledWith(29, 119, 3);
            expect(writeBytesSpy).toHaveBeenCalledWith(29, 107, 73);

            expect(writeBytesSpy).toHaveBeenCalledWith(5);
            expect(writeBytesSpy).toHaveBeenCalledWith(97);
            expect(writeBytesSpy).toHaveBeenCalledWith(98);
            expect(writeBytesSpy).toHaveBeenCalledWith(99);
            expect(writeBytesSpy).toHaveBeenCalledWith(100);
            expect(writeBytesSpy).toHaveBeenCalledWith(101);

            expect(timeoutSetSpy).toHaveBeenCalledWith(2_700_000);

            expect(thermalMqttastic['prevByte']).toBe(10);
            expect(mockLogger.table).toHaveBeenCalledWith({
                prevByte: 10,
            });

            expect(mockLogger.log).toHaveBeenCalledTimes(1);
            expect(mockLogger.table).toHaveBeenCalledTimes(1);
            expect(feedSpy).toHaveBeenCalledTimes(1);
            expect(writeBytesSpy).toHaveBeenCalledTimes(9);
            expect(timeoutSetSpy).toHaveBeenCalledTimes(1);
        });

        it('should validate the text parameter', async () => {
            expect.assertions(1);

            await expect(
                thermalMqttastic.printBarcode(
                    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
                    8,
                ),
            ).rejects.toThrow(ZodError);
        });
    });

    describe('normal', () => {
        it('should set print mode to normal', async () => {
            expect.assertions(7);

            const writePrintModeSpy = jest
                .spyOn(thermalMqttastic as any, 'writePrintMode')
                .mockImplementation(() => {});

            await thermalMqttastic.normal();

            expect(mockLogger.log).toHaveBeenCalledWith('normal called');

            expect(thermalMqttastic['printMode']).toBe(0);
            expect(mockLogger.table).toHaveBeenCalledWith({
                printMode: 0,
            });

            expect(writePrintModeSpy).toHaveBeenCalledWith();

            expect(mockLogger.log).toHaveBeenCalledTimes(1);
            expect(mockLogger.table).toHaveBeenCalledTimes(1);
            expect(writePrintModeSpy).toHaveBeenCalledTimes(1);
        });
    });

    describe('inverseOn', () => {
        it('should turn on inverse on old firmware', async () => {
            expect.assertions(5);

            // fake early firmware
            await thermalMqttastic.begin(12);

            // to not count mock calls during init
            jest.clearAllMocks();

            const writeBytesSpy = jest
                .spyOn(thermalMqttastic as any, 'writeBytes')
                .mockImplementation(() => {});
            const setPrintModeSpy = jest
                .spyOn(thermalMqttastic as any, 'setPrintMode')
                .mockImplementation(() => {});

            await thermalMqttastic.inverseOn();

            expect(mockLogger.log).toHaveBeenCalledWith('inverseOn called');

            expect(setPrintModeSpy).toHaveBeenCalledWith(2);

            expect(mockLogger.log).toHaveBeenCalledTimes(1);
            expect(setPrintModeSpy).toHaveBeenCalledTimes(1);
            expect(writeBytesSpy).not.toHaveBeenCalled();
        });

        it('should turn on inverse on new firmware', async () => {
            expect.assertions(5);

            const writeBytesSpy = jest
                .spyOn(thermalMqttastic as any, 'writeBytes')
                .mockImplementation(() => {});
            const setPrintModeSpy = jest
                .spyOn(thermalMqttastic as any, 'setPrintMode')
                .mockImplementation(() => {});

            await thermalMqttastic.inverseOn();

            expect(mockLogger.log).toHaveBeenCalledWith('inverseOn called');

            expect(writeBytesSpy).toHaveBeenCalledWith(29, 66, 1);

            expect(mockLogger.log).toHaveBeenCalledTimes(1);
            expect(setPrintModeSpy).not.toHaveBeenCalled();
            expect(writeBytesSpy).toHaveBeenCalledTimes(1);
        });
    });

    describe('inverseOff', () => {
        it('should turn off inverse on old firmware', async () => {
            expect.assertions(5);

            // fake early firmware
            await thermalMqttastic.begin(12);

            // to not count mock calls during init
            jest.clearAllMocks();

            const writeBytesSpy = jest
                .spyOn(thermalMqttastic as any, 'writeBytes')
                .mockImplementation(() => {});
            const unsetPrintModeSpy = jest
                .spyOn(thermalMqttastic as any, 'unsetPrintMode')
                .mockImplementation(() => {});

            await thermalMqttastic.inverseOff();

            expect(mockLogger.log).toHaveBeenCalledWith('inverseOff called');

            expect(unsetPrintModeSpy).toHaveBeenCalledWith(2);

            expect(mockLogger.log).toHaveBeenCalledTimes(1);
            expect(unsetPrintModeSpy).toHaveBeenCalledTimes(1);
            expect(writeBytesSpy).not.toHaveBeenCalled();
        });

        it('should turn off inverse on new firmware', async () => {
            expect.assertions(5);

            const writeBytesSpy = jest
                .spyOn(thermalMqttastic as any, 'writeBytes')
                .mockImplementation(() => {});
            const unsetPrintModeSpy = jest
                .spyOn(thermalMqttastic as any, 'unsetPrintMode')
                .mockImplementation(() => {});

            await thermalMqttastic.inverseOff();

            expect(mockLogger.log).toHaveBeenCalledWith('inverseOff called');

            expect(writeBytesSpy).toHaveBeenCalledWith(29, 66, 0);

            expect(mockLogger.log).toHaveBeenCalledTimes(1);
            expect(unsetPrintModeSpy).not.toHaveBeenCalled();
            expect(writeBytesSpy).toHaveBeenCalledTimes(1);
        });
    });

    describe('upsideDownOn', () => {
        it('should turn on inverse on old firmware', async () => {
            expect.assertions(5);

            // fake early firmware
            await thermalMqttastic.begin(12);

            // to not count mock calls during init
            jest.clearAllMocks();

            const writeBytesSpy = jest
                .spyOn(thermalMqttastic as any, 'writeBytes')
                .mockImplementation(() => {});
            const setPrintModeSpy = jest
                .spyOn(thermalMqttastic as any, 'setPrintMode')
                .mockImplementation(() => {});

            await thermalMqttastic.upsideDownOn();

            expect(mockLogger.log).toHaveBeenCalledWith('upsideDownOn called');

            expect(setPrintModeSpy).toHaveBeenCalledWith(4);

            expect(mockLogger.log).toHaveBeenCalledTimes(1);
            expect(setPrintModeSpy).toHaveBeenCalledTimes(1);
            expect(writeBytesSpy).not.toHaveBeenCalled();
        });

        it('should turn on inverse on new firmware', async () => {
            expect.assertions(5);

            const writeBytesSpy = jest
                .spyOn(thermalMqttastic as any, 'writeBytes')
                .mockImplementation(() => {});
            const setPrintModeSpy = jest
                .spyOn(thermalMqttastic as any, 'setPrintMode')
                .mockImplementation(() => {});

            await thermalMqttastic.upsideDownOn();

            expect(mockLogger.log).toHaveBeenCalledWith('upsideDownOn called');

            expect(writeBytesSpy).toHaveBeenCalledWith(27, 123, 1);

            expect(mockLogger.log).toHaveBeenCalledTimes(1);
            expect(setPrintModeSpy).not.toHaveBeenCalled();
            expect(writeBytesSpy).toHaveBeenCalledTimes(1);
        });
    });

    describe('upsideDownOff', () => {
        it('should turn off upside down on old firmware', async () => {
            expect.assertions(5);

            // fake early firmware
            await thermalMqttastic.begin(12);

            // to not count mock calls during init
            jest.clearAllMocks();

            const writeBytesSpy = jest
                .spyOn(thermalMqttastic as any, 'writeBytes')
                .mockImplementation(() => {});
            const unsetPrintModeSpy = jest
                .spyOn(thermalMqttastic as any, 'unsetPrintMode')
                .mockImplementation(() => {});

            await thermalMqttastic.upsideDownOff();

            expect(mockLogger.log).toHaveBeenCalledWith('upsideDownOff called');

            expect(unsetPrintModeSpy).toHaveBeenCalledWith(4);

            expect(mockLogger.log).toHaveBeenCalledTimes(1);
            expect(unsetPrintModeSpy).toHaveBeenCalledTimes(1);
            expect(writeBytesSpy).not.toHaveBeenCalled();
        });

        it('should turn off upside down on new firmware', async () => {
            expect.assertions(5);

            const writeBytesSpy = jest
                .spyOn(thermalMqttastic as any, 'writeBytes')
                .mockImplementation(() => {});
            const unsetPrintModeSpy = jest
                .spyOn(thermalMqttastic as any, 'unsetPrintMode')
                .mockImplementation(() => {});

            await thermalMqttastic.upsideDownOff();

            expect(mockLogger.log).toHaveBeenCalledWith('upsideDownOff called');

            expect(writeBytesSpy).toHaveBeenCalledWith(27, 123, 0);

            expect(mockLogger.log).toHaveBeenCalledTimes(1);
            expect(unsetPrintModeSpy).not.toHaveBeenCalled();
            expect(writeBytesSpy).toHaveBeenCalledTimes(1);
        });
    });

    describe('doubleHeightOn', () => {
        it('should turn on double height', async () => {
            expect.assertions(4);

            const setPrintModeSpy = jest
                .spyOn(thermalMqttastic as any, 'setPrintMode')
                .mockImplementation(() => {});

            await thermalMqttastic.doubleHeightOn();

            expect(mockLogger.log).toHaveBeenCalledWith('doubleHeightOn called');

            expect(setPrintModeSpy).toHaveBeenCalledWith(16);

            expect(mockLogger.log).toHaveBeenCalledTimes(1);
            expect(setPrintModeSpy).toHaveBeenCalledTimes(1);
        });
    });

    describe('doubleHeightOff', () => {
        it('should turn off double height', async () => {
            expect.assertions(4);

            const unsetPrintModeSpy = jest
                .spyOn(thermalMqttastic as any, 'unsetPrintMode')
                .mockImplementation(() => {});

            await thermalMqttastic.doubleHeightOff();

            expect(mockLogger.log).toHaveBeenCalledWith('doubleHeightOff called');

            expect(unsetPrintModeSpy).toHaveBeenCalledWith(16);

            expect(mockLogger.log).toHaveBeenCalledTimes(1);
            expect(unsetPrintModeSpy).toHaveBeenCalledTimes(1);
        });
    });

    describe('doubleWidthOn', () => {
        it('should turn on double width', async () => {
            expect.assertions(4);

            const setPrintModeSpy = jest
                .spyOn(thermalMqttastic as any, 'setPrintMode')
                .mockImplementation(() => {});

            await thermalMqttastic.doubleWidthOn();

            expect(mockLogger.log).toHaveBeenCalledWith('doubleWidthOn called');

            expect(setPrintModeSpy).toHaveBeenCalledWith(32);

            expect(mockLogger.log).toHaveBeenCalledTimes(1);
            expect(setPrintModeSpy).toHaveBeenCalledTimes(1);
        });
    });

    describe('doubleWidthOff', () => {
        it('should turn off double width', async () => {
            expect.assertions(4);

            const unsetPrintModeSpy = jest
                .spyOn(thermalMqttastic as any, 'unsetPrintMode')
                .mockImplementation(() => {});

            await thermalMqttastic.doubleWidthOff();

            expect(mockLogger.log).toHaveBeenCalledWith('doubleWidthOff called');

            expect(unsetPrintModeSpy).toHaveBeenCalledWith(32);

            expect(mockLogger.log).toHaveBeenCalledTimes(1);
            expect(unsetPrintModeSpy).toHaveBeenCalledTimes(1);
        });
    });

    describe('strikeOn', () => {
        it('should turn on strike', async () => {
            expect.assertions(4);

            const setPrintModeSpy = jest
                .spyOn(thermalMqttastic as any, 'setPrintMode')
                .mockImplementation(() => {});

            await thermalMqttastic.strikeOn();

            expect(mockLogger.log).toHaveBeenCalledWith('strikeOn called');

            expect(setPrintModeSpy).toHaveBeenCalledWith(64);

            expect(mockLogger.log).toHaveBeenCalledTimes(1);
            expect(setPrintModeSpy).toHaveBeenCalledTimes(1);
        });
    });

    describe('strikeOff', () => {
        it('should turn off strike', async () => {
            expect.assertions(4);

            const unsetPrintModeSpy = jest
                .spyOn(thermalMqttastic as any, 'unsetPrintMode')
                .mockImplementation(() => {});

            await thermalMqttastic.strikeOff();

            expect(mockLogger.log).toHaveBeenCalledWith('strikeOff called');

            expect(unsetPrintModeSpy).toHaveBeenCalledWith(64);

            expect(mockLogger.log).toHaveBeenCalledTimes(1);
            expect(unsetPrintModeSpy).toHaveBeenCalledTimes(1);
        });
    });

    describe('boldOn', () => {
        it('should turn on bold', async () => {
            expect.assertions(4);

            const setPrintModeSpy = jest
                .spyOn(thermalMqttastic as any, 'setPrintMode')
                .mockImplementation(() => {});

            await thermalMqttastic.boldOn();

            expect(mockLogger.log).toHaveBeenCalledWith('boldOn called');

            expect(setPrintModeSpy).toHaveBeenCalledWith(8);

            expect(mockLogger.log).toHaveBeenCalledTimes(1);
            expect(setPrintModeSpy).toHaveBeenCalledTimes(1);
        });
    });

    describe('boldOff', () => {
        it('should turn off bold', async () => {
            expect.assertions(4);

            const unsetPrintModeSpy = jest
                .spyOn(thermalMqttastic as any, 'unsetPrintMode')
                .mockImplementation(() => {});

            await thermalMqttastic.boldOff();

            expect(mockLogger.log).toHaveBeenCalledWith('boldOff called');

            expect(unsetPrintModeSpy).toHaveBeenCalledWith(8);

            expect(mockLogger.log).toHaveBeenCalledTimes(1);
            expect(unsetPrintModeSpy).toHaveBeenCalledTimes(1);
        });
    });

    describe('justify', () => {
        it('should justify default', async () => {
            expect.assertions(4);

            const writeBytespy = jest
                .spyOn(thermalMqttastic as any, 'writeBytes')
                .mockImplementation(() => {});

            await thermalMqttastic.justify();

            expect(mockLogger.log).toHaveBeenCalledWith('justify called');

            expect(writeBytespy).toHaveBeenCalledWith(27, 97, 0);

            expect(mockLogger.log).toHaveBeenCalledTimes(1);
            expect(writeBytespy).toHaveBeenCalledTimes(1);
        });

        it('should justify left', async () => {
            expect.assertions(4);

            const writeBytespy = jest
                .spyOn(thermalMqttastic as any, 'writeBytes')
                .mockImplementation(() => {});

            await thermalMqttastic.justify('L');

            expect(mockLogger.log).toHaveBeenCalledWith('justify called');

            expect(writeBytespy).toHaveBeenCalledWith(27, 97, 0);

            expect(mockLogger.log).toHaveBeenCalledTimes(1);
            expect(writeBytespy).toHaveBeenCalledTimes(1);
        });

        it('should justify right', async () => {
            expect.assertions(4);

            const writeBytespy = jest
                .spyOn(thermalMqttastic as any, 'writeBytes')
                .mockImplementation(() => {});

            await thermalMqttastic.justify('R');

            expect(mockLogger.log).toHaveBeenCalledWith('justify called');

            expect(writeBytespy).toHaveBeenCalledWith(27, 97, 2);

            expect(mockLogger.log).toHaveBeenCalledTimes(1);
            expect(writeBytespy).toHaveBeenCalledTimes(1);
        });

        it('should justify center', async () => {
            expect.assertions(4);

            const writeBytespy = jest
                .spyOn(thermalMqttastic as any, 'writeBytes')
                .mockImplementation(() => {});

            await thermalMqttastic.justify('C');

            expect(mockLogger.log).toHaveBeenCalledWith('justify called');

            expect(writeBytespy).toHaveBeenCalledWith(27, 97, 1);

            expect(mockLogger.log).toHaveBeenCalledTimes(1);
            expect(writeBytespy).toHaveBeenCalledTimes(1);
        });
    });

    describe('feed', () => {
        it('should feed lines default lines', async () => {
            expect.assertions(7);

            const writeBytesSpy = jest
                .spyOn(thermalMqttastic as any, 'writeBytes')
                .mockImplementation(() => {});
            const timeoutSetSpy = jest
                .spyOn(thermalMqttastic as any, 'timeoutSet')
                .mockImplementation(() => {});
            const writeSpy = jest
                .spyOn(thermalMqttastic as any, 'write')
                .mockImplementation(() => {});

            await thermalMqttastic.feed();

            expect(mockLogger.log).toHaveBeenCalledWith('feed called');

            expect(writeBytesSpy).toHaveBeenCalledWith(27, 100, 1);

            expect(timeoutSetSpy).toHaveBeenCalledWith(50_400);

            expect(mockLogger.log).toHaveBeenCalledTimes(1);
            expect(timeoutSetSpy).toHaveBeenCalledTimes(1);
            expect(writeBytesSpy).toHaveBeenCalledTimes(1);
            expect(writeSpy).not.toHaveBeenCalled();
        });

        it('should feed lines on old firmware', async () => {
            expect.assertions(7);

            // fake early firmware
            await thermalMqttastic.begin(12);

            // to not count mock calls during init
            jest.clearAllMocks();

            const writeBytesSpy = jest
                .spyOn(thermalMqttastic as any, 'writeBytes')
                .mockImplementation(() => {});
            const timeoutSetSpy = jest
                .spyOn(thermalMqttastic as any, 'timeoutSet')
                .mockImplementation(() => {});
            const writeSpy = jest
                .spyOn(thermalMqttastic as any, 'write')
                .mockImplementation(() => {});

            await thermalMqttastic.feed(2);

            expect(mockLogger.log).toHaveBeenCalledWith('feed called');

            expect(writeSpy).toHaveBeenCalledWith(10);
            expect(writeSpy).toHaveBeenCalledWith(10);

            expect(mockLogger.log).toHaveBeenCalledTimes(1);
            expect(writeSpy).toHaveBeenCalledTimes(2);
            expect(timeoutSetSpy).not.toHaveBeenCalled();
            expect(writeBytesSpy).not.toHaveBeenCalled();
        });

        it('should feed lines on new firmware', async () => {
            expect.assertions(7);

            const writeBytesSpy = jest
                .spyOn(thermalMqttastic as any, 'writeBytes')
                .mockImplementation(() => {});
            const timeoutSetSpy = jest
                .spyOn(thermalMqttastic as any, 'timeoutSet')
                .mockImplementation(() => {});
            const writeSpy = jest
                .spyOn(thermalMqttastic as any, 'write')
                .mockImplementation(() => {});

            await thermalMqttastic.feed(2);

            expect(mockLogger.log).toHaveBeenCalledWith('feed called');

            expect(writeBytesSpy).toHaveBeenCalledWith(27, 100, 2);

            expect(timeoutSetSpy).toHaveBeenCalledWith(50_400);

            expect(mockLogger.log).toHaveBeenCalledTimes(1);
            expect(timeoutSetSpy).toHaveBeenCalledTimes(1);
            expect(writeBytesSpy).toHaveBeenCalledTimes(1);
            expect(writeSpy).not.toHaveBeenCalled();
        });
    });

    describe('feedRows', () => {
        it('should feed default rows', async () => {
            expect.assertions(10);

            const writeBytesSpy = jest
                .spyOn(thermalMqttastic as any, 'writeBytes')
                .mockImplementation(() => {});
            const timeoutSetSpy = jest
                .spyOn(thermalMqttastic as any, 'timeoutSet')
                .mockImplementation(() => {});

            await thermalMqttastic.feedRows();

            expect(mockLogger.log).toHaveBeenCalledWith('feedRows called');

            expect(writeBytesSpy).toHaveBeenCalledWith(27, 74, 1);

            expect(timeoutSetSpy).toHaveBeenCalledWith(2_100);

            expect(thermalMqttastic['prevByte']).toBe(10);
            expect(thermalMqttastic['column']).toBe(0);
            expect(mockLogger.table).toHaveBeenCalledWith({
                prevByte: 10,
                column: 0,
            });

            expect(mockLogger.log).toHaveBeenCalledTimes(1);
            expect(writeBytesSpy).toHaveBeenCalledTimes(1);
            expect(timeoutSetSpy).toHaveBeenCalledTimes(1);
            expect(mockLogger.table).toHaveBeenCalledTimes(1);
        });

        it('should feed rows', async () => {
            expect.assertions(10);

            const writeBytesSpy = jest
                .spyOn(thermalMqttastic as any, 'writeBytes')
                .mockImplementation(() => {});
            const timeoutSetSpy = jest
                .spyOn(thermalMqttastic as any, 'timeoutSet')
                .mockImplementation(() => {});

            await thermalMqttastic.feedRows(2);

            expect(mockLogger.log).toHaveBeenCalledWith('feedRows called');

            expect(writeBytesSpy).toHaveBeenCalledWith(27, 74, 2);

            expect(timeoutSetSpy).toHaveBeenCalledWith(4_200);

            expect(thermalMqttastic['prevByte']).toBe(10);
            expect(thermalMqttastic['column']).toBe(0);
            expect(mockLogger.table).toHaveBeenCalledWith({
                prevByte: 10,
                column: 0,
            });

            expect(mockLogger.log).toHaveBeenCalledTimes(1);
            expect(writeBytesSpy).toHaveBeenCalledTimes(1);
            expect(timeoutSetSpy).toHaveBeenCalledTimes(1);
            expect(mockLogger.table).toHaveBeenCalledTimes(1);
        });

        it('should validate the rows parameter', async () => {
            expect.assertions(3);

            await expect(thermalMqttastic.feedRows(-1)).rejects.toThrow(ZodError);
            await expect(thermalMqttastic.feedRows(0)).rejects.toThrow(ZodError);
            await expect(thermalMqttastic.feedRows(1.1)).rejects.toThrow(ZodError);
        });
    });

    describe('flush', () => {
        it('should flush', async () => {
            expect.assertions(4);

            const writeBytesSpy = jest
                .spyOn(thermalMqttastic as any, 'writeBytes')
                .mockImplementation(() => {});

            await thermalMqttastic.flush();

            expect(mockLogger.log).toHaveBeenCalledWith('flush called');

            expect(writeBytesSpy).toHaveBeenCalledWith(12);

            expect(mockLogger.log).toHaveBeenCalledTimes(1);
            expect(writeBytesSpy).toHaveBeenCalledTimes(1);
        });
    });

    describe('setSize', () => {
        it('should set default size', async () => {
            expect.assertions(6);

            const doubleHeightOnSpy = jest
                .spyOn(thermalMqttastic as any, 'doubleHeightOn')
                .mockImplementation(() => {});
            const doubleHeightOffSpy = jest
                .spyOn(thermalMqttastic as any, 'doubleHeightOff')
                .mockImplementation(() => {});
            const doubleWidthOnSpy = jest
                .spyOn(thermalMqttastic as any, 'doubleWidthOn')
                .mockImplementation(() => {});
            const doubleWidthOffSpy = jest
                .spyOn(thermalMqttastic as any, 'doubleWidthOff')
                .mockImplementation(() => {});

            await thermalMqttastic.setSize();

            expect(mockLogger.log).toHaveBeenCalledWith('setSize called');

            expect(mockLogger.log).toHaveBeenCalledTimes(1);
            expect(doubleWidthOffSpy).toHaveBeenCalledTimes(1);
            expect(doubleHeightOffSpy).toHaveBeenCalledTimes(1);
            expect(doubleWidthOnSpy).not.toHaveBeenCalled();
            expect(doubleHeightOnSpy).not.toHaveBeenCalled();
        });

        it('should size to small', async () => {
            expect.assertions(6);

            const doubleHeightOnSpy = jest
                .spyOn(thermalMqttastic as any, 'doubleHeightOn')
                .mockImplementation(() => {});
            const doubleHeightOffSpy = jest
                .spyOn(thermalMqttastic as any, 'doubleHeightOff')
                .mockImplementation(() => {});
            const doubleWidthOnSpy = jest
                .spyOn(thermalMqttastic as any, 'doubleWidthOn')
                .mockImplementation(() => {});
            const doubleWidthOffSpy = jest
                .spyOn(thermalMqttastic as any, 'doubleWidthOff')
                .mockImplementation(() => {});

            await thermalMqttastic.setSize('S');

            expect(mockLogger.log).toHaveBeenCalledWith('setSize called');

            expect(mockLogger.log).toHaveBeenCalledTimes(1);
            expect(doubleWidthOffSpy).toHaveBeenCalledTimes(1);
            expect(doubleHeightOffSpy).toHaveBeenCalledTimes(1);
            expect(doubleWidthOnSpy).not.toHaveBeenCalled();
            expect(doubleHeightOnSpy).not.toHaveBeenCalled();
        });

        it('should size to medium', async () => {
            expect.assertions(6);

            const doubleHeightOnSpy = jest
                .spyOn(thermalMqttastic as any, 'doubleHeightOn')
                .mockImplementation(() => {});
            const doubleHeightOffSpy = jest
                .spyOn(thermalMqttastic as any, 'doubleHeightOff')
                .mockImplementation(() => {});
            const doubleWidthOnSpy = jest
                .spyOn(thermalMqttastic as any, 'doubleWidthOn')
                .mockImplementation(() => {});
            const doubleWidthOffSpy = jest
                .spyOn(thermalMqttastic as any, 'doubleWidthOff')
                .mockImplementation(() => {});

            await thermalMqttastic.setSize('M');

            expect(mockLogger.log).toHaveBeenCalledWith('setSize called');

            expect(mockLogger.log).toHaveBeenCalledTimes(1);
            expect(doubleHeightOnSpy).toHaveBeenCalledTimes(1);
            expect(doubleWidthOffSpy).toHaveBeenCalledTimes(1);
            expect(doubleHeightOffSpy).not.toHaveBeenCalled();
            expect(doubleWidthOnSpy).not.toHaveBeenCalled();
        });

        it('should size to large', async () => {
            expect.assertions(6);

            const doubleHeightOnSpy = jest
                .spyOn(thermalMqttastic as any, 'doubleHeightOn')
                .mockImplementation(() => {});
            const doubleHeightOffSpy = jest
                .spyOn(thermalMqttastic as any, 'doubleHeightOff')
                .mockImplementation(() => {});
            const doubleWidthOnSpy = jest
                .spyOn(thermalMqttastic as any, 'doubleWidthOn')
                .mockImplementation(() => {});
            const doubleWidthOffSpy = jest
                .spyOn(thermalMqttastic as any, 'doubleWidthOff')
                .mockImplementation(() => {});

            await thermalMqttastic.setSize('L');

            expect(mockLogger.log).toHaveBeenCalledWith('setSize called');

            expect(mockLogger.log).toHaveBeenCalledTimes(1);
            expect(doubleHeightOnSpy).toHaveBeenCalledTimes(1);
            expect(doubleWidthOnSpy).toHaveBeenCalledTimes(1);
            expect(doubleHeightOffSpy).not.toHaveBeenCalled();
            expect(doubleWidthOffSpy).not.toHaveBeenCalled();
        });
    });

    describe('setHeatConfig', () => {
        it('should throw', async () => {
            expect.assertions(1);

            await expect(thermalMqttastic.setHeatConfig()).rejects.toThrow(Error);
        });
    });

    describe('setPrintDensity', () => {
        it('should set default print density', async () => {
            expect.assertions(4);

            const writeBytesSpy = jest
                .spyOn(thermalMqttastic as any, 'writeBytes')
                .mockImplementation(() => {});

            await thermalMqttastic.setPrintDensity();

            expect(mockLogger.log).toHaveBeenCalledWith('setPrintDensity called');

            expect(writeBytesSpy).toHaveBeenCalledWith(18, 35, 322);

            expect(mockLogger.log).toHaveBeenCalledTimes(1);
            expect(writeBytesSpy).toHaveBeenCalledTimes(1);
        });

        it('should set print density', async () => {
            expect.assertions(4);

            const writeBytesSpy = jest
                .spyOn(thermalMqttastic as any, 'writeBytes')
                .mockImplementation(() => {});

            await thermalMqttastic.setPrintDensity(12, 3);

            expect(mockLogger.log).toHaveBeenCalledWith('setPrintDensity called');

            expect(writeBytesSpy).toHaveBeenCalledWith(18, 35, 387);

            expect(mockLogger.log).toHaveBeenCalledTimes(1);
            expect(writeBytesSpy).toHaveBeenCalledTimes(1);
        });

        it('should validate the density parameter', async () => {
            expect.assertions(3);

            await expect(thermalMqttastic.setPrintDensity(13.1, 2)).rejects.toThrow(ZodError);
            await expect(thermalMqttastic.setPrintDensity(-13, 2)).rejects.toThrow(ZodError);
            await expect(thermalMqttastic.setPrintDensity(32, 2)).rejects.toThrow(ZodError);
        });

        it('should validate the breakTime parameter', async () => {
            expect.assertions(3);

            await expect(thermalMqttastic.setPrintDensity(10, 2.1)).rejects.toThrow(ZodError);
            await expect(thermalMqttastic.setPrintDensity(10, -2)).rejects.toThrow(ZodError);
            await expect(thermalMqttastic.setPrintDensity(10, 8)).rejects.toThrow(ZodError);
        });
    });

    describe('underlineOn', () => {
        it('should set default underline', async () => {
            expect.assertions(4);

            const writeBytesSpy = jest
                .spyOn(thermalMqttastic as any, 'writeBytes')
                .mockImplementation(() => {});

            await thermalMqttastic.underlineOn();

            expect(mockLogger.log).toHaveBeenCalledWith('underlineOn called');

            expect(writeBytesSpy).toHaveBeenCalledWith(27, 45, 1);

            expect(mockLogger.log).toHaveBeenCalledTimes(1);
            expect(writeBytesSpy).toHaveBeenCalledTimes(1);
        });

        it('should set underline', async () => {
            expect.assertions(4);

            const writeBytesSpy = jest
                .spyOn(thermalMqttastic as any, 'writeBytes')
                .mockImplementation(() => {});

            await thermalMqttastic.underlineOn(2);

            expect(mockLogger.log).toHaveBeenCalledWith('underlineOn called');

            expect(writeBytesSpy).toHaveBeenCalledWith(27, 45, 2);

            expect(mockLogger.log).toHaveBeenCalledTimes(1);
            expect(writeBytesSpy).toHaveBeenCalledTimes(1);
        });
    });

    describe('underlineOff', () => {
        it('should turn off underline', async () => {
            expect.assertions(4);

            const writeBytesSpy = jest
                .spyOn(thermalMqttastic as any, 'writeBytes')
                .mockImplementation(() => {});

            await thermalMqttastic.underlineOff();

            expect(mockLogger.log).toHaveBeenCalledWith('underlineOff called');

            expect(writeBytesSpy).toHaveBeenCalledWith(27, 45, 0);

            expect(mockLogger.log).toHaveBeenCalledTimes(1);
            expect(writeBytesSpy).toHaveBeenCalledTimes(1);
        });
    });

    // TODO: add more tests
    describe('printBitmap', () => {
        let writeBytesSpy: jest.SpyInstance;
        let timeoutWaitSpy: jest.SpyInstance;
        let timeoutSetSpy: jest.SpyInstance;

        const expectPayload = (...payload: number[]) => {
            expect(timeoutWaitSpy).toHaveBeenCalledWith();
            expect(writeBytesSpy).toHaveBeenCalledWith(...payload);
        };

        beforeEach(() => {
            writeBytesSpy = jest
                .spyOn(thermalMqttastic as any, 'writeBytes')
                .mockImplementation(() => {});
            timeoutWaitSpy = jest
                .spyOn(thermalMqttastic as any, 'timeoutWait')
                .mockImplementation(() => {});
            timeoutSetSpy = jest
                .spyOn(thermalMqttastic as any, 'timeoutSet')
                .mockImplementation(() => {});
        });

        // TODO: Not sure if the test is wrong or my implementation. WIP for now
        it.skip('should print a bitmap', async () => {
            expect.assertions(14);

            await thermalMqttastic.printBitmap(2, 2, new Uint8Array([0, 255, 255, 0]));

            expect(mockLogger.log).toHaveBeenCalledWith('printBitmap called');

            expect(writeBytesSpy).toHaveBeenCalledWith(18, 42, 2, 1);

            expectPayload(0, 255);
            expectPayload(255, 0);

            expect(timeoutSetSpy).toHaveBeenCalledWith(60_000);

            expect(thermalMqttastic['prevByte']).toBe(10);
            expect(mockLogger.table).toHaveBeenCalledWith({
                prevByte: 10,
            });

            expect(mockLogger.log).toHaveBeenCalledTimes(1);
            expect(writeBytesSpy).toHaveBeenCalledTimes(1);
            expect(timeoutWaitSpy).toHaveBeenCalledTimes(2);
            expect(timeoutSetSpy).toHaveBeenCalledTimes(1);
            expect(mockLogger.table).toHaveBeenCalledTimes(1);
        });

        it('should print a bitmap with maximum width and large height', async () => {
            expect.assertions(6_256);

            await thermalMqttastic.printBitmap(
                384,
                256,
                new Uint8Array(Array.from({ length: 384 * 256 }, () => 255)),
            );

            expect(mockLogger.log).toHaveBeenCalledWith('printBitmap called');

            for (let y = 0; y < 52; y++) {
                expect(writeBytesSpy).toHaveBeenCalledWith(18, 42, 5, 48);
            }

            for (let y = 0; y < 3_072; y++) {
                expectPayload(255, 255, 255, 255);
            }

            for (let y = 0; y < 52; y++) {
                expect(timeoutSetSpy).toHaveBeenCalledWith(150_000);
            }

            expect(thermalMqttastic['prevByte']).toBe(10);
            expect(mockLogger.table).toHaveBeenCalledWith({
                prevByte: 10,
            });

            expect(mockLogger.log).toHaveBeenCalledTimes(1);
            expect(writeBytesSpy).toHaveBeenCalledTimes(3_124);
            expect(timeoutWaitSpy).toHaveBeenCalledTimes(3_072);
            expect(timeoutSetSpy).toHaveBeenCalledTimes(52);
            expect(mockLogger.table).toHaveBeenCalledTimes(1);
        });

        // TODO: Not sure if the test is wrong or my implementation. WIP for now
        it.skip('should print a bitmap with single row', async () => {
            expect.assertions(6);

            await thermalMqttastic.printBitmap(8, 1, new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7]));

            expect(mockLogger.log).toHaveBeenCalledWith('printBitmap called');

            expect(writeBytesSpy).toHaveBeenCalledWith(18, 42, 1, 2);

            expectPayload(0, 1);
            expectPayload(2, 3);
            expectPayload(4, 5);
            expectPayload(6, 7);

            expect(timeoutSetSpy).toHaveBeenCalledWith(23);

            expect(thermalMqttastic['prevByte']).toBe(10);
            expect(mockLogger.table).toHaveBeenCalledWith({
                prevByte: 10,
            });

            expect(mockLogger.log).toHaveBeenCalledTimes(1);
            expect(writeBytesSpy).toHaveBeenCalledTimes(1);
            expect(timeoutWaitSpy).toHaveBeenCalledTimes(2);
            expect(timeoutSetSpy).toHaveBeenCalledTimes(2);
            expect(mockLogger.table).toHaveBeenCalledTimes(1);
        });
    });

    describe('offline', () => {
        it('should put printer offline', async () => {
            expect.assertions(4);

            const writeBytesSpy = jest
                .spyOn(thermalMqttastic as any, 'writeBytes')
                .mockImplementation(() => {});

            await thermalMqttastic.offline();

            expect(mockLogger.log).toHaveBeenCalledWith('offline called');

            expect(writeBytesSpy).toHaveBeenCalledWith(27, 61, 0);

            expect(mockLogger.log).toHaveBeenCalledTimes(1);
            expect(writeBytesSpy).toHaveBeenCalledTimes(1);
        });
    });

    describe('online', () => {
        it('should put printer online', async () => {
            expect.assertions(4);

            const writeBytesSpy = jest
                .spyOn(thermalMqttastic as any, 'writeBytes')
                .mockImplementation(() => {});

            await thermalMqttastic.online();

            expect(mockLogger.log).toHaveBeenCalledWith('online called');

            expect(writeBytesSpy).toHaveBeenCalledWith(27, 61, 1);

            expect(mockLogger.log).toHaveBeenCalledTimes(1);
            expect(writeBytesSpy).toHaveBeenCalledTimes(1);
        });
    });

    describe('sleep', () => {
        it('should put printer to sleep', async () => {
            expect.assertions(4);

            const sleepAfterSpy = jest
                .spyOn(thermalMqttastic as any, 'sleepAfter')
                .mockImplementation(() => {});

            await thermalMqttastic.sleep();

            expect(mockLogger.log).toHaveBeenCalledWith('sleep called');

            expect(sleepAfterSpy).toHaveBeenCalledWith(1);

            expect(mockLogger.log).toHaveBeenCalledTimes(1);
            expect(sleepAfterSpy).toHaveBeenCalledTimes(1);
        });
    });

    describe('sleepAfter', () => {
        it('should sleep after seconds with old firmware', async () => {
            expect.assertions(4);

            // fake early firmware
            await thermalMqttastic.begin(12);

            // to not count mock calls during init
            jest.clearAllMocks();

            const writeBytesSpy = jest
                .spyOn(thermalMqttastic as any, 'writeBytes')
                .mockImplementation(() => {});

            await thermalMqttastic.sleepAfter(1);

            expect(mockLogger.log).toHaveBeenCalledWith('sleepAfter called');

            expect(writeBytesSpy).toHaveBeenCalledWith(27, 56, 1);

            expect(mockLogger.log).toHaveBeenCalledTimes(1);
            expect(writeBytesSpy).toHaveBeenCalledTimes(1);
        });

        it('should sleep after seconds with new firmware', async () => {
            expect.assertions(4);

            const writeBytesSpy = jest
                .spyOn(thermalMqttastic as any, 'writeBytes')
                .mockImplementation(() => {});

            await thermalMqttastic.sleepAfter(1);

            expect(mockLogger.log).toHaveBeenCalledWith('sleepAfter called');

            expect(writeBytesSpy).toHaveBeenCalledWith(27, 56, 1, 0);

            expect(mockLogger.log).toHaveBeenCalledTimes(1);
            expect(writeBytesSpy).toHaveBeenCalledTimes(1);
        });

        it('should validate the seconds parameter', async () => {
            expect.assertions(2);

            await expect(thermalMqttastic.sleepAfter(2.1)).rejects.toThrow(ZodError);
            await expect(thermalMqttastic.sleepAfter(0)).rejects.toThrow(ZodError);
        });
    });

    describe('wake', () => {
        it('should wake with old firmware', async () => {
            expect.assertions(26);

            // fake early firmware
            await thermalMqttastic.begin(12);

            // to not count mock calls during init
            jest.clearAllMocks();

            const writeBytesSpy = jest
                .spyOn(thermalMqttastic as any, 'writeBytes')
                .mockImplementation(() => {});
            const timeoutSetSpy = jest
                .spyOn(thermalMqttastic as any, 'timeoutSet')
                .mockImplementation(() => {});

            await thermalMqttastic.wake();

            expect(mockLogger.log).toHaveBeenCalledWith('wake called');

            expect(timeoutSetSpy).toHaveBeenCalledWith(0);

            expect(writeBytesSpy).toHaveBeenCalledWith(255);

            for (let index = 0; index < 10; index++) {
                expect(writeBytesSpy).toHaveBeenCalledWith(0);
                expect(timeoutSetSpy).toHaveBeenCalledWith(10_000);
            }

            expect(mockLogger.log).toHaveBeenCalledTimes(1);
            expect(timeoutSetSpy).toHaveBeenCalledTimes(11);
            expect(writeBytesSpy).toHaveBeenCalledTimes(11);
        });

        it('should wake with new firmware', async () => {
            expect.assertions(9);

            const writeBytesSpy = jest
                .spyOn(thermalMqttastic as any, 'writeBytes')
                .mockImplementation(() => {});
            const timeoutSetSpy = jest
                .spyOn(thermalMqttastic as any, 'timeoutSet')
                .mockImplementation(() => {});

            await thermalMqttastic.wake();

            expect(mockLogger.log).toHaveBeenCalledWith('wake called');

            expect(timeoutSetSpy).toHaveBeenCalledWith(0);

            expect(writeBytesSpy).toHaveBeenCalledWith(255);

            expect(delay).toHaveBeenCalledWith(50);

            expect(writeBytesSpy).toHaveBeenCalledWith(27, 56, 0, 0);

            expect(mockLogger.log).toHaveBeenCalledTimes(1);
            expect(timeoutSetSpy).toHaveBeenCalledTimes(1);
            expect(delay).toHaveBeenCalledTimes(1);
            expect(writeBytesSpy).toHaveBeenCalledTimes(2);
        });
    });

    describe('hasPaper', () => {
        it('should throw', async () => {
            expect.assertions(1);

            await expect(thermalMqttastic.hasPaper()).rejects.toThrow(Error);
        });
    });

    describe('setLineHeight', () => {
        it('should set line height default', async () => {
            expect.assertions(7);

            const writeBytesSpy = jest
                .spyOn(thermalMqttastic as any, 'writeBytes')
                .mockImplementation(() => {});

            await thermalMqttastic.setLineHeight();

            expect(mockLogger.log).toHaveBeenCalledWith('setLineHeight called');

            expect(thermalMqttastic['lineSpacing']).toBe(6);
            expect(mockLogger.table).toHaveBeenCalledWith({
                lineSpacing: 6,
            });

            expect(writeBytesSpy).toHaveBeenCalledWith(27, 51, 30);

            expect(mockLogger.log).toHaveBeenCalledTimes(1);
            expect(mockLogger.table).toHaveBeenCalledTimes(1);
            expect(writeBytesSpy).toHaveBeenCalledTimes(1);
        });

        it('should set line height', async () => {
            expect.assertions(7);

            const writeBytesSpy = jest
                .spyOn(thermalMqttastic as any, 'writeBytes')
                .mockImplementation(() => {});

            await thermalMqttastic.setLineHeight(31);

            expect(mockLogger.log).toHaveBeenCalledWith('setLineHeight called');

            expect(thermalMqttastic['lineSpacing']).toBe(7);
            expect(mockLogger.table).toHaveBeenCalledWith({
                lineSpacing: 7,
            });

            expect(writeBytesSpy).toHaveBeenCalledWith(27, 51, 31);

            expect(mockLogger.log).toHaveBeenCalledTimes(1);
            expect(mockLogger.table).toHaveBeenCalledTimes(1);
            expect(writeBytesSpy).toHaveBeenCalledTimes(1);
        });

        it('should validate the value parameter', async () => {
            expect.assertions(2);

            await expect(thermalMqttastic.setLineHeight(24.1)).rejects.toThrow(ZodError);
            await expect(thermalMqttastic.setLineHeight(23)).rejects.toThrow(ZodError);
        });
    });

    describe('setMaxChunkHeight', () => {
        it('should set may chunk height default', async () => {
            expect.assertions(5);

            thermalMqttastic.setMaxChunkHeight();

            expect(mockLogger.log).toHaveBeenCalledWith('setMaxChunkHeight called');

            expect(thermalMqttastic['maxChunkHeight']).toBe(256);
            expect(mockLogger.table).toHaveBeenCalledWith({
                maxChunkHeight: 256,
            });

            expect(mockLogger.log).toHaveBeenCalledTimes(1);
            expect(mockLogger.table).toHaveBeenCalledTimes(1);
        });

        it('should set may chunk height', async () => {
            expect.assertions(5);

            thermalMqttastic.setMaxChunkHeight(12);

            expect(mockLogger.log).toHaveBeenCalledWith('setMaxChunkHeight called');

            expect(thermalMqttastic['maxChunkHeight']).toBe(12);
            expect(mockLogger.table).toHaveBeenCalledWith({
                maxChunkHeight: 12,
            });

            expect(mockLogger.log).toHaveBeenCalledTimes(1);
            expect(mockLogger.table).toHaveBeenCalledTimes(1);
        });

        it('should validate the value parameter', async () => {
            expect.assertions(2);

            expect(() => thermalMqttastic.setMaxChunkHeight(24.1)).toThrow(ZodError);
            expect(() => thermalMqttastic.setMaxChunkHeight(0)).toThrow(ZodError);
        });
    });

    describe('setCharset', () => {
        it('should set charset default', async () => {
            expect.assertions(4);

            const writeBytesSpy = jest
                .spyOn(thermalMqttastic as any, 'writeBytes')
                .mockImplementation(() => {});

            await thermalMqttastic.setCharset();

            expect(mockLogger.log).toHaveBeenCalledWith('setCharset called');

            expect(writeBytesSpy).toHaveBeenCalledWith(27, 82, 0);

            expect(mockLogger.log).toHaveBeenCalledTimes(1);
            expect(writeBytesSpy).toHaveBeenCalledTimes(1);
        });

        it('should set charset', async () => {
            expect.assertions(4);

            const writeBytesSpy = jest
                .spyOn(thermalMqttastic as any, 'writeBytes')
                .mockImplementation(() => {});

            await thermalMqttastic.setCharset(15);

            expect(mockLogger.log).toHaveBeenCalledWith('setCharset called');

            expect(writeBytesSpy).toHaveBeenCalledWith(27, 82, 15);

            expect(mockLogger.log).toHaveBeenCalledTimes(1);
            expect(writeBytesSpy).toHaveBeenCalledTimes(1);
        });

        it('should validate the value parameter', async () => {
            expect.assertions(2);

            await expect(thermalMqttastic.setCharset(10.1)).rejects.toThrow(ZodError);
            await expect(thermalMqttastic.setCharset(23)).rejects.toThrow(ZodError);
        });
    });

    describe('setCodePage', () => {
        it('should set code page default', async () => {
            expect.assertions(4);

            const writeBytesSpy = jest
                .spyOn(thermalMqttastic as any, 'writeBytes')
                .mockImplementation(() => {});

            await thermalMqttastic.setCodePage();

            expect(mockLogger.log).toHaveBeenCalledWith('setCodePage called');

            expect(writeBytesSpy).toHaveBeenCalledWith(27, 116, 0);

            expect(mockLogger.log).toHaveBeenCalledTimes(1);
            expect(writeBytesSpy).toHaveBeenCalledTimes(1);
        });

        it('should set code page', async () => {
            expect.assertions(4);

            const writeBytesSpy = jest
                .spyOn(thermalMqttastic as any, 'writeBytes')
                .mockImplementation(() => {});

            await thermalMqttastic.setCodePage(15);

            expect(mockLogger.log).toHaveBeenCalledWith('setCodePage called');

            expect(writeBytesSpy).toHaveBeenCalledWith(27, 116, 15);

            expect(mockLogger.log).toHaveBeenCalledTimes(1);
            expect(writeBytesSpy).toHaveBeenCalledTimes(1);
        });

        it('should validate the value parameter', async () => {
            expect.assertions(3);

            await expect(thermalMqttastic.setCodePage(1.1)).rejects.toThrow(ZodError);
            await expect(thermalMqttastic.setCodePage(-1)).rejects.toThrow(ZodError);
            await expect(thermalMqttastic.setCodePage(48)).rejects.toThrow(ZodError);
        });
    });

    describe('tab', () => {
        it('should tab', async () => {
            expect.assertions(7);

            const writeBytesSpy = jest
                .spyOn(thermalMqttastic as any, 'writeBytes')
                .mockImplementation(() => {});

            await thermalMqttastic.tab();

            expect(mockLogger.log).toHaveBeenCalledWith('tab called');

            expect(writeBytesSpy).toHaveBeenCalledWith(9);

            expect(thermalMqttastic['column']).toBe(4);
            expect(mockLogger.table).toHaveBeenCalledWith({
                column: 4,
            });

            expect(mockLogger.log).toHaveBeenCalledTimes(1);
            expect(mockLogger.table).toHaveBeenCalledTimes(1);
            expect(writeBytesSpy).toHaveBeenCalledTimes(1);
        });
    });

    describe('setFont', () => {
        it('should set default font', async () => {
            expect.assertions(4);

            const setPrintModeSpy = jest
                .spyOn(thermalMqttastic as any, 'setPrintMode')
                .mockImplementation(() => {});
            const unsetPrintModeSpy = jest
                .spyOn(thermalMqttastic as any, 'unsetPrintMode')
                .mockImplementation(() => {});

            await thermalMqttastic.setFont();

            expect(mockLogger.log).toHaveBeenCalledWith('setFont called');

            expect(unsetPrintModeSpy).toHaveBeenCalledWith(1);

            expect(unsetPrintModeSpy).toHaveBeenCalledTimes(1);
            expect(setPrintModeSpy).not.toHaveBeenCalled();
        });

        it('should set A font', async () => {
            expect.assertions(4);

            const setPrintModeSpy = jest
                .spyOn(thermalMqttastic as any, 'setPrintMode')
                .mockImplementation(() => {});
            const unsetPrintModeSpy = jest
                .spyOn(thermalMqttastic as any, 'unsetPrintMode')
                .mockImplementation(() => {});

            await thermalMqttastic.setFont('A');

            expect(mockLogger.log).toHaveBeenCalledWith('setFont called');

            expect(unsetPrintModeSpy).toHaveBeenCalledWith(1);

            expect(unsetPrintModeSpy).toHaveBeenCalledTimes(1);
            expect(setPrintModeSpy).not.toHaveBeenCalled();
        });

        it('should set B font', async () => {
            expect.assertions(4);

            const setPrintModeSpy = jest
                .spyOn(thermalMqttastic as any, 'setPrintMode')
                .mockImplementation(() => {});
            const unsetPrintModeSpy = jest
                .spyOn(thermalMqttastic as any, 'unsetPrintMode')
                .mockImplementation(() => {});

            await thermalMqttastic.setFont('B');

            expect(mockLogger.log).toHaveBeenCalledWith('setFont called');

            expect(setPrintModeSpy).toHaveBeenCalledWith(1);

            expect(setPrintModeSpy).toHaveBeenCalledTimes(1);
            expect(unsetPrintModeSpy).not.toHaveBeenCalled();
        });
    });

    describe('setCharSpacing', () => {
        it('should set character spacing default', async () => {
            expect.assertions(4);

            const writeBytesSpy = jest
                .spyOn(thermalMqttastic as any, 'writeBytes')
                .mockImplementation(() => {});

            await thermalMqttastic.setCharSpacing();

            expect(mockLogger.log).toHaveBeenCalledWith('setCharSpacing called');

            expect(writeBytesSpy).toHaveBeenCalledWith(27, 32, 0);

            expect(mockLogger.log).toHaveBeenCalledTimes(1);
            expect(writeBytesSpy).toHaveBeenCalledTimes(1);
        });

        it('should set character spacing', async () => {
            expect.assertions(4);

            const writeBytesSpy = jest
                .spyOn(thermalMqttastic as any, 'writeBytes')
                .mockImplementation(() => {});

            await thermalMqttastic.setCharSpacing(15);

            expect(mockLogger.log).toHaveBeenCalledWith('setCharSpacing called');

            expect(writeBytesSpy).toHaveBeenCalledWith(27, 32, 15);

            expect(mockLogger.log).toHaveBeenCalledTimes(1);
            expect(writeBytesSpy).toHaveBeenCalledTimes(1);
        });

        it('should validate the spacing parameter', async () => {
            expect.assertions(2);

            await expect(thermalMqttastic.setCharSpacing(1.1)).rejects.toThrow(ZodError);
            await expect(thermalMqttastic.setCharSpacing(-1)).rejects.toThrow(ZodError);
        });
    });
});
