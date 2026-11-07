# Bluetooth protocol

The scooter link is fully portable to TypeScript. In the original app it is plain
Java and Kotlin, there is no native code in the bike path. The `libBluConnect-Lib.so`
that carries the name is the Aptener BluArmor helmet intercom SDK, not the scooter.

## Connection

| Item | Value | Where it comes from |
| --- | --- | --- |
| Service uuid, Apache / IQUBE | `5456534D-5647-5341-5342-454E544F5251` | hardcoded in `ApacheBLEConnectionConfig` |
| Service uuid, U388 / Ikarus / U546 | `5456534d-5647-5555-5342-454e544f5251` | hardcoded in `BluetoothConstants` |
| Service uuid derived from the phone imei | `xxxxxxxx-xxxx-xxx9-5342-454E544F5251` | `DashboardFragment.o0` in the original app |
| Read characteristic | `00005354-0000-1000-8000-00805f9b34fb` | hardcoded |
| Write characteristic | `00005352-0000-1000-8000-00805f9b34fb` | hardcoded |
| MTU | 512 | `BluetoothConstants.BLE_MTU` |
| Write type | 2, write with response | `WriteType.WITH_RESPONSE` |

The imei derivation: take the fifteen digits of the phone imei, uppercase them, and
build `slice(0,8) + '-' + slice(8,12) + '-' + slice(12,15) + '9-5342-454E544F5251'`.
For the imei `863077040382909` that gives `86307704-0382-9099-5342-454E544F5251`,
which is also the fallback constant in the original app.

This is what makes the app work without a TVS account: the characteristics are
hardcoded and the service uuid is derived on the phone. The older bike families
(N109, N112, N251, N360, U399, U449) are different: their uuids arrive from a
server api that needs a login, and their payloads are obfuscated with a xor
against `0xEA`. Those are not supported yet.

## Encryption

The frame that arrives over ble is **not** the frame the parser sees. The original
decrypts it first, in `BluetoothUtil.decryptDataForApache`:

```
out[0]        = in[0]                 the start byte, kept
out[1]        = in[1]                 the data id, kept
out[2..n-2]   = in[2..n-2] XOR 0xEA   the payload
out[n-1]      = 0xFF                  the end byte, the incoming tail is dropped
```

The key is a constant `0xEA` for the newer families. The legacy families use `0xEB`
in `BluetoothUtil.decryptData`. Without this step every field reads as noise.

The checksum lives in the second to last slot of the **decrypted** frame. The original
sums every byte except the last two and requires:

```
checksum + (sum of the first n-2 bytes) % 256 == 255
```

so the checksum of a frame is `255 - (sum of the first n-2 bytes) % 256`. The same
rule builds an outbound packet: payload, then the checksum, then the end byte, then
the same xor envelope.

## Frame format

Every frame starts with `0x5A` (the original also accepts `0x9B`), then a data id,
then the payload, then a checksum and an end byte. The original parser reads a
field by taking the bytes of a 1 based range, formatting them as hex and parsing
the result as an integer, so the fields are big endian. The parser reads
`start - 1` and clamps the end to the length of the buffer.

The checksum is parsed as a normal field and the receive path does not validate
it, so the port does not reject a frame on a bad checksum either.

```
byte   0      1       2 ...              n-2      n-1
     start   dataId   payload           checksum  end
```

| Data id | Frame | Original class | Used for |
| --- | --- | --- | --- |
| 16 | 5A_10 | `ApacheSpeedOMeter1` | speed, odometer, fuel, average and top speed, throttle, switches |
| 17 | 5A_11 | `ApacheSpeedOMeter2` | vehicle state, gear, service reminder, turn indicator, diagnostics |
| 18 | 5A_12 | `ApacheSpeedOMeter3` | lean angle, cruising range, trip distance, time, mileage, fuel, overspeed |
| 22 | 5A_16 | `U399SpeedMeter4` | lap times and best lap |
| 24 | 5A_18 | `ApacheSpeedMeter5` | engine load, temperatures, battery voltage, run time, distance |
| 25 | trip data | | trip A and trip B |
| 41 | wifi password | `N597LoggedData` | phone to vehicle pairing |
| 107 | music control | | remote music commands |

The 5A_10 layout, taken from `ApacheSpeedOMeter1` in the original app:

| Start | Length | Field | Scale |
| --- | --- | --- | --- |
| 1 | 1 | start byte | |
| 2 | 1 | data id | |
| 3 | 1 | speed | km/h |
| 4 | 3 | odometer | raw / 10 |
| 7 | 1 | fuel level | percent |
| 8 | 1 | average speed | |
| 9 | 1 | economy status | |
| 10 | 1 | top speed | |
| 11 | 1 | throttle | percent |
| 12 | 1 | switch status | bit field |
| 13 | 1 | time to 60 km/h | |
| 14 | 1 | average mileage | |
| 15 | 2 | trip f meter | |
| 17 | 2 | engine rpm | |
| 19 | 1 | checksum | |
| 20 | 1 | end byte | |

The odometer is stored raw and divided by ten by the getter of the original
class, the port does the same.

The switch status bit field carries the side stand and the turn signals. The
turn indicator has its own field in the 5A_11 frame, so the port prefers that one
and falls back to the switch status.

## Implementation in this project

| File | Role |
| --- | --- |
| `src/ble/constants.ts` | uuids, data ids, start bytes, timeouts |
| `src/ble/protocol.ts` | the xor envelope and the checksum |
| `src/ble/serviceUuid.ts` | the imei derivation |
| `src/ble/frames.ts` | the offset tables |
| `src/ble/parser.ts` | the parser and the telemetry mapping |
| `src/ble/bleService.ts` | the react-native-ble-plx wrapper |
| `src/ble/connectionController.ts` | the state machine, scanning and reconnect |

## Still to confirm

- Whether the newer bikes answer on the imei derived service uuid or only on the
  hardcoded one. The implementation scans for both and reads the characteristics of
  every service it finds, so either works.
- The exact bit layout of the switch status and the turn indicator fields. The
  port uses bit 1 for the side stand and bits 2 and 4 for the turn signals, taken
  from the original frame model, but the bit order has not been verified against a
  real frame.
- Whether the bike expects anything else before it starts streaming, for example a
  handshake packet. The original app writes to the cluster for the phone pairing and
  the music commands, so a connection may need a first packet from the phone.
- The frames of the other families, Ntorq, Jupiter, U388 and IQUBE, live in the same
  package with their own tables and are not ported yet.

## The other families

The same package holds the frames of the other bikes: `ntorq/NtorqSpeedOMeter1..4`,
`jupiter/JupiterSpeedOMeter1..4`, `u388/U388SpeedometerFrameData` and
`u399/U399SpeedMeter1..4`. They use the same frame format, so adding a family is
a matter of copying its offset table into `src/ble/frames.ts`.

## How to capture the real frames

With the phone connected over usb and the app running, read the logcat of the
original app on a rooted phone, or capture the frames from this app by adding a
temporary log of the raw bytes in `connectionController.handleData`. The frame
length is twenty bytes for the speedometer frames, the data id is the second byte.
