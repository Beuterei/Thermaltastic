import * as index from '../src';
import { MqttasticAdapter } from '../src/adapters/MqttasticAdapter';
import { AsciiCode, Barcode, CharacterCommands, CharacterSet, CodePage } from '../src/enums';
import { Thermaltastic } from '../src/Thermaltastic';

describe('export', () => {
    it('should be exported', () => {
        expect(index).toEqual({
            MqttasticAdapter,
            Thermaltastic,
            CharacterSet,
            CodePage,
            Barcode,
            AsciiCode,
            CharacterCommands,
        });
    });
});
