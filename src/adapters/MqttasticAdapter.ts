/* eslint-disable canonical/filename-match-regex */
import type { AsyncMqttClient, IClientOptions } from 'async-mqtt';
import { connectAsync } from 'async-mqtt';
import type { Adapter } from '../Thermaltastic';

export interface MqttasticAdapterInitOptions {
    mqttOptions?: IClientOptions;
    mqttUrl: string;
}

export class MqttasticAdapter implements Adapter {
    public async begin() {
        this.mqttClient = await connectAsync(this.mqttUrl, this.mqttOptions);
    }

    public constructor(initOptions: MqttasticAdapterInitOptions) {
        this.mqttUrl = initOptions.mqttUrl;
        this.mqttOptions = initOptions.mqttOptions;
    }

    protected mqttClient?: AsyncMqttClient;

    protected mqttOptions?: IClientOptions;

    protected mqttUrl: string;

    protected async publish(topic: string, payload: string) {
        if (!this.mqttClient) {
            throw new Error('MQTT client is not initialized. Did you call begin()?');
        }

        await this.mqttClient.publish(topic, payload, { qos: 2 });
    }

    public async write(...bytes: [number, number?, number?, number?]) {
        const payloadString = bytes.join(',');

        await this.publish('write', payloadString);
    }

    public async writeBytes(...bytes: [number, number?, number?, number?]) {
        const payloadString = bytes.join(',');

        await this.publish('writeBytes', payloadString);
    }
}
