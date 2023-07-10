[![Contributors][contributors-shield]][contributors-url]
[![Forks][forks-shield]][forks-url]
[![Stargazers][stars-shield]][stars-url]
[![Issues][issues-shield]][issues-url]

<!-- PROJECT HEADER -->
<br />
<p align="center">
  <h3 align="center">Thermaltastic</h3>

  <p align="center">
    <img align="center" src="./images/print.jpg" alt="drawing" width="170"/>
    <br />
    <br />
    Control a Adafruit thermal printer over different adapters. This library is very WIP.
    <br />
    <br />
    ·
    <a href="https://github.com/beuluis/Thermaltastic/issues">Report Bug</a>
    ·
    <a href="https://github.com/beuluis/Thermaltastic/issues">Request Feature</a>
    ·
  </p>
</p>

<!-- ABOUT THE PROJECT -->

## About The Project

I wanted to talk to a thermal printer over an api. I experimented with a esp32 and quickly came to its limits.

After investigating the [Adafruit library](https://github.com/adafruit/Adafruit-Thermal-Printer-Library/tree/master) and many many failed other attempts, I concluded that I can extract the heavy lifting to TypeScript and only run a light mqtt to serial implementation on the esp32.

To allow different 'streams' like mqtt I came up with the adapter concept.

So now you can utilize the versatile package landscape of NPM to generate bitmaps, wrap it in REST APIs and and and.

## Installation

```bash
npm i @beuluis/thermaltastic
```

### Unstable installation

The `next` dist-tag is kept in sync with the latest commit on main. So this contains always the latest changes but is highly unstable.

```bash
npm i @beuluis/thermaltastic@next
```

## Usage

```typescript
const printer = new Thermaltastic(adapter);

await printer.begin();

await printer.println('Hello World!');
```

## Adapters

The original library used a serial stream to send the bytes to the printer. In this implementation we use adapters to achieve this.

A adapter defines how the printer receives the bytes.

### MqttasticAdapter

Send the to print bytes over mqtt.

> :warning: **You need the corresponding arduino MQTT client also listening**: See [ThermalMqttasticPrinter](https://registry.platformio.org/libraries/beuluis/ThermalMqttasticPrinter) for more details.

You also need a MQTT broker. An example would be [eclipse-mosquitto](https://hub.docker.com/_/eclipse-mosquitto).

```typescript
const adapter = new MqttasticAdapter({
    mqttUrl: 'mqtt://localhost:1883',
    mqttOptions: {
        password: '12345678',
    },
});

new Thermaltastic(adapter);
```

#### MQTT connection

`mqttOptions` is the option interface of the [MQTT](https://www.npmjs.com/package/mqtt) package. Please refer to this documentation on how to establish the connection.

### Implement your own adapter

For your own adapter you just need to implement the `Adapter` interface.

```typescript
export class MyAdapter implements Adapter {
    public async begin() {}

    public async write(...bytes: [number, number?, number?, number?]) {}

    public async writeBytes(...bytes: [number, number?, number?, number?]) {}
}
```

## Functions

Parameters get validated using [zod](https://www.npmjs.com/package/zod). Please refer to this documentation on how the parameters get validated.

### `setTimes(dotPrintTime: number, dotFeedTime: number)`

This method sets the times (in microseconds) for the paper to advance one vertical 'dot' when printing and when feeding.

#### Parameter constrains:

-   `z.number().int().nonnegative().parse(dotPrintTime);`
-   `z.number().int().nonnegative().parse(dotFeedTime);`

#### Example

```typescript
printer.setTimes(10, 15);
```

### `print(message: string)`

Prints the message.

#### Example

```typescript
await printer.print('Hello World!');
```

### `println(message: string)`

Prints the message with a line break at the end.

#### Example

```typescript
await printer.println('Hello World!');
```

### `begin(firmware = 268)`

Initializes the printer and set default values. Needs to be called before performing any operations!

#### Parameter constrains:

-   `z.number().int().nonnegative().parse(firmware);`

#### Example

```typescript
await printer.begin();
```

### `reset()`

Resets the printer!

#### Example

```typescript
await printer.begin();
```

### `setDefaults()`

Resets all text formatting back to the defaults.

#### Example

```typescript
await printer.setDefaults();
```

### `test()`

Prints a test.

#### Example

```typescript
await printer.test();
```

### `testPage()`

Prints a test page.

#### Example

```typescript
await printer.testPage();
```

### `setBarcodeHeight(barcodeHeight = 50)`

Sets the printing height of the barcode.

#### Parameter constrains:

-   `z.number().int().nonnegative().parse(barcodeHeight);`

#### Example

```typescript
await printer.setBarcodeHeight(60);
```

### `printBarcode(text: string, type: Barcode)`

Prints a barcode.

#### Parameter constrains:

-   `z.string().max(255).parse(text);`

#### Example

```typescript
await printer.printBarcode('ADAFRUT', Barcode.CODE39);
```

### `normal()`

Sets print mode to normal.

#### Example

```typescript
await printer.normal();
```

### `inverseOn()`

Turn on inverse print mode.

#### Example

```typescript
await printer.inverseOn();
```

### `inverseOff()`

Turn off inverse print mode.

#### Example

```typescript
await printer.inverseOff();
```

### `upsideDownOn()`

Turn on upside down print mode.

#### Example

```typescript
await printer.upsideDownOn();
```

### `upsideDownOff()`

Turn off upside down print mode.

#### Example

```typescript
await printer.upsideDownOff();
```

### `doubleHeightOn()`

Turn on double height print mode.

#### Example

```typescript
await printer.doubleHeightOn();
```

### `doubleHeightOff()`

Turn off double height print mode.

#### Example

```typescript
await printer.doubleHeightOff();
```

### `doubleWidthOn()`

Turn on double width print mode.

#### Example

```typescript
await printer.doubleWidthOn();
```

### `doubleWidthOff()`

Turn off double width print mode.

#### Example

```typescript
await printer.doubleWidthOff();
```

### `strikeOn()`

Turn on strike print mode.

#### Example

```typescript
await printer.strikeOn();
```

### `strikeOff()`

Turn off strike print mode.

#### Example

```typescript
await printer.strikeOff();
```

### `boldOn()`

Turn on bold print mode.

#### Example

```typescript
await printer.boldOn();
```

### `boldOff()`

Turn off bold print mode.

#### Example

```typescript
await printer.boldOff();
```

### `justify(value: 'C' | 'L' | 'R' = 'L')`

Justifies the content.

#### Example

```typescript
await printer.justify('C');
```

### `feed(lines = 1)`

Feeds lines of paper.

#### Parameter constrains:

-   `z.number().int().min(1).parse(lines);`

#### Example

```typescript
await printer.feed(2);
```

### `feedRows(rows = 1)`

Feeds rows of paper.

#### Parameter constrains:

-   `z.number().int().min(1).parse(rows);`

#### Example

```typescript
await printer.feedRows(2);
```

### `flush()`

Flush the printer.

#### Example

```typescript
await printer.flush(2);
```

### `setSize(value: 'L' | 'M' | 'S' = 'S')`

Set the text size.

#### Example

```typescript
await printer.setSize('L');
```

### `setPrintDensity(density = 10, breakTime = 2)`

Sets the printer density.

#### Parameter constrains:

-   `z.number().int().nonnegative().max(31).parse(density);`
-   `z.number().int().nonnegative().max(7).parse(breakTime);`

#### Example

```typescript
await printer.setPrintDensity(11, 3);
```

### `underlineOn()`

Turn on underline.

#### Example

```typescript
await printer.underlineOn();
```

### `underlineOff()`

Turn off underline.

#### Example

```typescript
await printer.underlineOff();
```

### `printBitmap(width: number, height: number, bitmap: Uint8Array)`

> :warning: **WIP**

Prints a bitmap.

#### Parameter constrains:

-   `z.number().int().nonnegative().max(384).parse(width);`
-   `z.number().int().min(1).parse(height);`

#### Example

```typescript
await printer.printBitmap(2, 2, new Uint8Array([0, 255, 255, 0]));
```

### `offline()`

Take the printer offline. Print commands sent after this will be ignored until `online` is called.

#### Example

```typescript
await printer.offline();
```

### `online()`

Take the printer online.

#### Example

```typescript
await printer.online();
```

### `sleep()`

Put the printer into a low-energy state immediately.

#### Example

```typescript
await printer.sleep();
```

### `sleepAfter(seconds: number)`

Put the printer into a low-energy state after the given number of seconds.

#### Parameter constrains:

-   `z.number().int().min(1).parse(seconds);`

#### Example

```typescript
await printer.sleepAfter(1);
```

### `wake()`

Wake the printer from a low-energy state.

#### Example

```typescript
await printer.wake();
```

### `setMaxChunkHeight(value = 256)`

Set maximum chunk height for bitmap printing.

#### Parameter constrains:

-   `z.number().int().min(1).parse(value);`

#### Example

```typescript
printer.setMaxChunkHeight(200);
```

### `setCharset(value = 0)`

Set maximum chunk height for bitmap printing. May only work in recent firmware.

#### Parameter constrains:

-   `z.number().int().nonnegative().max(15).parse(value);`

#### Example

```typescript
printer.setCharset(10);
```

### `setCodePage(value = 0)`

Select alternate characters for upper ASCII. May only work in recent firmware.

#### Parameter constrains:

-   `z.number().int().nonnegative().max(47).parse(value);`

#### Example

```typescript
await printer.setCodePage(12);
```

### `tab()`

Print a tab. May only work in recent firmware.

#### Example

```typescript
await printer.tab();
```

### `setFont(font: 'A' | 'B' = 'A')`

Sets font type. May only work in recent firmware.

#### Example

```typescript
await printer.setFont('B');
```

### `setCharSpacing(spacing = 0)`

Set character spacing. May only work in recent firmware.

#### Parameter constrains:

-   `z.number().int().nonnegative().parse(spacing);`

#### Example

```typescript
await printer.setCharSpacing(10);
```

## Debugging

You can enable the debugging logger when you provide a logger to the constructor.

```typescript
const printer = new Thermaltastic(adapter, {
    logger: console,
});
```

<!-- CONTRIBUTING -->

## Contributing

Contributions are what make the open source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

<!-- CONTACT -->

## Contact

Luis Beu - me@luisbeu.de

<!-- MARKDOWN LINKS & IMAGES -->
<!-- https://www.markdownguide.org/basic-syntax/#reference-style-links -->

[contributors-shield]: https://img.shields.io/github/contributors/beuluis/Thermaltastic.svg?style=flat-square
[contributors-url]: https://github.com/beuluis/Thermaltastic/graphs/contributors
[forks-shield]: https://img.shields.io/github/forks/beuluis/Thermaltastic.svg?style=flat-square
[forks-url]: https://github.com/beuluis/Thermaltastic/network/members
[stars-shield]: https://img.shields.io/github/stars/beuluis/Thermaltastic.svg?style=flat-square
[stars-url]: https://github.com/beuluis/Thermaltastic/stargazers
[issues-shield]: https://img.shields.io/github/issues/beuluis/Thermaltastic.svg?style=flat-square
[issues-url]: https://github.com/beuluis/Thermaltastic/issues
[license-shield]: https://img.shields.io/github/license/beuluis/Thermaltastic.svg?style=flat-square
