import * as index from '../src';
import { ThermalMqttastic } from '../src/ThermalMqttastic';
import { CharacterSet, CodePage, Barcode, AsciiCode, CharacterCommands } from '../src/enums';

describe('export', () => {
    it('should be exported', () => {
        expect(index).toEqual({
            ThermalMqttastic,
            CharacterSet,
            CodePage,
            Barcode,
            AsciiCode,
            CharacterCommands,
        });
    });
});
