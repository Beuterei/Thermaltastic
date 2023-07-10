import * as index from '../src';
import { Thermaltastic } from '../src/Thermaltastic';
import { MqttasticAdapter } from '../src/adapters/MqttasticAdapter';
import { CharacterSet, CodePage, Barcode, AsciiCode, CharacterCommands } from '../src/enums';

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
