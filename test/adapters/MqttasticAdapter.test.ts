/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/dot-notation */
import { MqttasticAdapter } from '../../src';
import { type AsyncMqttClient, connectAsync } from 'async-mqtt';
import { mock } from 'jest-mock-extended';

jest.mock('async-mqtt', () => ({
    connectAsync: jest.fn(() => mock<AsyncMqttClient>()),
}));

describe('MqttasticAdapter', () => {
    let mqttasticAdapter: MqttasticAdapter;

    beforeEach(async () => {
        mqttasticAdapter = new MqttasticAdapter({
            mqttUrl: 'mqtt://test',
            mqttOptions: {
                password: 'test',
            },
        });

        await mqttasticAdapter.begin();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('begin', () => {
        it('should initialize client', async () => {
            expect.assertions(2);

            await mqttasticAdapter['publish']('test', 'payload');

            expect(connectAsync).toHaveBeenCalledWith('mqtt://test', {
                password: 'test',
            });

            expect(connectAsync).toHaveBeenCalledTimes(1);
        });
    });

    describe('constructor', () => {
        it('should initialize class', () => {
            expect(mqttasticAdapter['mqttOptions']).toStrictEqual({
                password: 'test',
            });
            expect(mqttasticAdapter['mqttUrl']).toBe('mqtt://test');
        });
    });

    describe('publish', () => {
        it('should publish topic', async () => {
            expect.assertions(2);

            await mqttasticAdapter['publish']('test', 'payload');

            // eslint-disable-next-line jest/unbound-method
            expect(mqttasticAdapter['mqttClient']?.publish).toHaveBeenCalledWith(
                'test',
                'payload',
                { qos: 2 },
            );

            // eslint-disable-next-line jest/unbound-method
            expect(mqttasticAdapter['mqttClient']?.publish).toHaveBeenCalledTimes(1);
        });

        it('should throw when no client is initialized', async () => {
            expect.assertions(2);

            mqttasticAdapter = new MqttasticAdapter({
                mqttUrl: 'mqtt://test',
                mqttOptions: {
                    password: 'test',
                },
            });

            await expect(mqttasticAdapter['publish']('test', 'payload')).rejects.toThrow(Error);

            expect(mqttasticAdapter['mqttClient']).toBeUndefined();
        });
    });

    describe('write', () => {
        it('should write', async () => {
            expect.assertions(2);

            const publishSpy = jest
                .spyOn(mqttasticAdapter as any, 'publish')
                .mockImplementation(() => {});

            await mqttasticAdapter.write(12, 13);

            expect(publishSpy).toHaveBeenCalledWith('write', '12,13');

            expect(publishSpy).toHaveBeenCalledTimes(1);
        });
    });

    describe('writeBytes', () => {
        it('should write bytes', async () => {
            expect.assertions(2);

            const publishSpy = jest
                .spyOn(mqttasticAdapter as any, 'publish')
                .mockImplementation(() => {});

            await mqttasticAdapter.writeBytes(12, 13);

            expect(publishSpy).toHaveBeenCalledWith('writeBytes', '12,13');

            expect(publishSpy).toHaveBeenCalledTimes(1);
        });
    });
});
