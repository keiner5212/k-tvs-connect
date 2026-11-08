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
against `0xEA`. The app finds those uuids in the discovery instead, and it
speaks the letter frames of the N112 family. See "The legacy family" below.

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

## The navigation frame

The cluster shows the turn while riding. The original sends the frame
`5A 4E` (`ApacheClusterNavigationData.toByteArray`), **with a checksum**, every
400 milliseconds while the navigation runs (`MapHostActivity.startTimer`).

| Byte | Value |
| --- | --- |
| 0 | `0x5A` |
| 1 | `0x4E` (78) |
| 2, 3 | distance to the next manoeuvre in metres. Zero is sent as one metre, over 65535 as `FF FF` |
| 4, 5 | minutes left. Over 65535 as `FF FF` |
| 6, 7, 8 | metres left to the destination, the low three bytes, big endian |
| 9 | pictogram id |
| 10 | one or two strings |
| 11 | navigation status: 0 off, 1 running, `FF` rerouting |
| 12 | unit, always 0 (metric) |
| 13 | alert: 1 when the gps is off or the phone has no network |
| 14 | how close the turn is: 1 between 65 and 1000 metres, 3 a left turn under 65 metres, 4 a right turn under 65 metres, 5 over 1000 metres, 6 when the gps is off |
| 15 to 17 | reserved, zero |
| 18 | checksum |
| 19 | `0xFF` |

The checksum is what the original writes and what the cluster expects, so a
frame without it is dropped by the cluster. That was the bug in this port: the
frame carried the instruction text where the original has reserved bytes and it
had no checksum.

The pictogram ids of the cluster are a different numbering than the icons of
the original app. The original maps the id of the map provider to the id of the
cluster (`ApacheUtils.mapPictoIdForApache`) and the provider ids of google,
here and mappls are in `ApacheUtils.java`. The semantic name of every cluster id
is not in the original app, so this port sends 0 and 34 when there is no
manoeuvre left. Confirming the ids needs a real cluster.

## What the original sends that this port does not

For the apache family the original never writes the destination address
(`5B 5C`), the traffic sequence (`5B 4C`) or the road name (`5A 49`). It sends
the name (`5B 52`) once, the mobile data (`5B 4A`) every two seconds and the
navigation (`5A 4E`) every 400 milliseconds. This port sends the address and
the traffic sequence as well, because the other families need them, but the
bytes are the ones the original builds.

The cellular signal of the `5B 4A` frame needs `READ_PHONE_STATE` in the
original. This port sends zero instead of asking for that permission.

The original never writes the text of a notification to the cluster. Its
notification listener only produces the social counters (`5B 9C`) and the media
metadata (`5B 61`, `5B 62`, `5B 63` with the play state `5B 60`). This port
also sends the caller info (`5B 43`), so the cluster can show an incoming call,
which is more than the original does.

## Implementation in this project

| File | Role |
| --- | --- |
| `src/ble/constants.ts` | uuids, data ids, start bytes, timeouts |
| `src/ble/protocol.ts` | the xor envelope and the checksum |
| `src/services/cluster.service.ts` | the foreground service and the battery settings |
| `modules/ktvs-cluster` | the native module with the foreground service |
| `src/ble/frames.ts` | the offset tables of the modern frames |
| `src/ble/parser.ts` | the parser and the telemetry mapping of both families |
| `src/ble/bleService.ts` | the react-native-ble-plx wrapper |
| `src/ble/connectionController.ts` | the state machine, scanning and reconnect |

## The RTR 160 IoT V2 family

The bike of the rider is the RTR 160 IoT V2, which the original app calls
N112_V2 (`SecretIdentifier.SERVICE_UUID_N112_V2 = "SERVICE_UUID_RTR_160_IOT_V2"`)
and pairs with the U399C uuids. That family takes its uuids from the server,
so the app finds them in the discovery instead:

| Kind | Uuid | Properties |
| --- | --- | --- |
| service | `00005500-d102-11e1-9b23-000240198212` | |
| read | `00005501-d102-11e1-9b23-000240198212` | notify |
| write | `00005502-d102-11e1-9b23-000240198212` | write without response |
| data | `00005503-d102-11e1-9b23-000240198212` | write with response, indicate |
| read | `00005504-d102-11e1-9b23-000240198212` | read |

It speaks the same frames as the newer bikes: a start byte, a data id at byte 1
and twenty bytes. Three things are different.

- The payload is xored with **0xEB**, not 0xEA. The original encrypts and
  decrypts it with `U368EncryptDecryptDataUtils`, whose key is -21, and the
  receiver rejects any frame that is not twenty bytes long.
- The original writes it with the write type "with response"
  (`U399HelperService.getCharacteristicsWriteType()` returns 2 and
  `U507SendDataToCluster` writes with the literal 2), so the endpoint to write
  to is `5503`, the one that takes a write with response.
- The rider name goes five times with a pause of 400 ms between them, then the
  mobile data frame with the clock, the battery, the signal and the missed
  calls. The name is not sanitised: `BluetoothUtil.createRiderNameArray` sends
  it as it is, unlike the newer family that replaces every symbol with an X.

The N112 family, the one before the V2, is a different one: it speaks letter
frames, a prefix byte and the value. It is not the family of this bike.

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
- The frames the legacy family uses for the maneuvers (`4E` and `4F` outbound in
  the original are `4E` navigation N and `4F` navigation O). Their layout is in
  `N112SendDataToCluster`, and the port does not write them yet, so the app says
  the destination did not go to the bike.

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
