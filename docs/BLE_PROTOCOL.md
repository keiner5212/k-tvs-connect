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

## Frame format

Every frame starts with `0x5A`, then a data id, then the payload, then a checksum
and an end byte. The original parser reads a field by taking the bytes of a
1 based range, formatting them as hex and parsing the result as an integer, so
the fields are big endian.

```
byte   0      1       2 ...              n-2      n-1
     start   dataId   payload           checksum  end
```

| Data id | Frame | Used for |
| --- | --- | --- |
| 16 | 5A_10 | speedometer, first block |
| 17 | 5A_11 | speedometer, second block |
| 18 | 5A_12 | speedometer, third block |
| 22 | 5A_16 | speedometer, fourth block |
| 24 | 5A_18 | speedometer, fifth block |
| 25 | trip data | trip A and trip B |
| 41 | wifi password | phone to vehicle pairing |
| 107 | music control | remote music commands |

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

The switch status bit field carries the side stand and the turn signals.

## Implementation in this project

| File | Role |
| --- | --- |
| `src/ble/constants.ts` | uuids, data ids, start bytes, timeouts |
| `src/ble/serviceUuid.ts` | the imei derivation |
| `src/ble/frames.ts` | the offset tables |
| `src/ble/parser.ts` | the parser and the telemetry mapping |
| `src/ble/bleService.ts` | the react-native-ble-plx wrapper |
| `src/ble/connectionController.ts` | the state machine, scanning and reconnect |

## Still to confirm

- The checksum algorithm. The original computes it in `BlePacketsProvider.getChecksum`,
  the port has to be checked against it before the frames can be trusted.
- The offsets of the frames 5A_11, 5A_12, 5A_16 and 5A_18. Only 5A_10 is ported so far.
- Whether the newer bikes answer on the imei derived service uuid or only on the
  hardcoded one. The implementation scans for both.
- Whether the link is encrypted or paired. The legacy family uses xor obfuscation,
  the newer one may use a handshake that is not visible in the Java layer.

## How to capture the real frames

With the phone connected over usb and the app running, read the logcat of the
original app on a rooted phone, or capture the frames from this app by adding a
temporary log of the raw bytes in `connectionController.handleData`. The frame
length is twenty bytes for the speedometer frames, the data id is the second byte.
