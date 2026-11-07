# Reverse engineering notes

Target: `com.tvsm.connect.latam`, "TVS Connect - LATAM", versionCode 44, versionName 4.4.0.
minSdk 28, targetSdk 35, compileSdk 36. The internal build string is
`TVSConnect-8.8.0_latamProdRelease`.

The goal of the analysis is not to clone the app. It is to recover the bluetooth
protocol so a replacement client can talk to the scooter, and to know what the
original app did with the data so the replacement can do without the account.

## XAPK layout

```
com.tvsm.connect.latam-44_arm64-v8a.xapk
  base.apk                     192 MB, 17 dex files, all resources
  split_config.arm64_v8a.apk    64 MB, 85 native libraries
  split_config.xxhdpi.apk      29 MB, hdpi and xxhdpi drawables
  manifest.json                package, version, split list
```

The native libraries live in the ABI split, not in `base.apk`. Any tool that only
receives `base.apk` sees no `.so` files.

## The correction that matters

`libBluConnect-Lib.so` is **not** the scooter. It is the Aptener BluArmor helmet
intercom SDK: it loads a firebase configuration from inside the `.so` and drives a
classic bluetooth OBEX link to the helmet. Nothing in `com/aptener/**` touches
scooter data.

The scooter link is entirely Java and Kotlin:

| Concern | Where |
| --- | --- |
| New stack, Apache / Jupiter / Ntorq / IQUBE / U388 | `com/tvsm/bike/**`, `com/tvs/ble/**`, `com/tvs/bluetooth/**` |
| Legacy stack, N109 / N112 / N251 / N360 / U399 / U449 | `com/tvsm/connect/bluetooth/**` |
| Frame format | `com/tvsm/bike/core/protocol/**` with the `@ParsingMeta` annotation |
| Outbound commands | `com/tvsm/bluetooth/core/utils/BlePacketsProvider` |
| Uuids | `com/tvsm/bike/core/bikes/*BLEConnectionConfig`, `com/tvs/bluetooth/core/utils/BluetoothConstants` |

No native code is involved, so the protocol is portable to TypeScript. The port
lives in `src/ble/` and is described in [BLE_PROTOCOL.md](BLE_PROTOCOL.md).

## Two stacks

Both are still in the release build and they are not compatible.

- The new stack hardcodes the read and write characteristics and derives the
  service uuid from the phone imei. It needs no account, which is why this project
  targets it.
- The legacy stack takes the service and characteristic uuids from a server api
  (`getSecuredKeys`) whose values are RSA decrypted with a key that comes from the
  login flow, and it obfuscates the payloads with a xor against `0xEA`. That path
  cannot work without a TVS account.

## Architecture of the original app

- Kotlin and Compose on top of a Views base, Hilt for injection, Room and
  Retrofit for the server side.
- Voice assistant: Cerence (`libcerence_ark_core.so`), ARK engine
  (`libark_conversation_engine.so`), ASR (`libnds_asr5.so`).
- Maps: HERE (`libheresdk.so`, 66 MB) and MapmyIndia (`libmappls-gl.so`). The
  replacement uses OpenFreeMap instead.
- Telemetry goes to an azure service bus topic, `dev-tvsm-telemetry-event-hub`.

## What the original server was used for

Kept here as background only, the replacement does not call any of it.

| Host | Purpose |
| --- | --- |
| `tvsconnectapi.tvsmotor.com` | account, vehicles, profile, rewards, referrals |
| `p360.tvsmotor.com` | the p360 platform, gapi and rapi |
| `cdpcom-dev.tvsmotor.com` | customer data platform, graphql |
| `myassistancenow.com` | roadside assist |
| `tvsmapisrvr.tvsmotor.com` | service booking, soap |

The authentication was mobile number plus otp, with the token pair carried in
headers (`userid`, `AccessToken`, `RefreshToken`, `token`, `ICEUserId`, `EVUserId`,
`countryId`, `Region`, `lang`, `version`, `TVS-User-Agent`) instead of a bearer
scheme.

The release binary also carries a hardcoded shared credential pair for the
roadside assist service in `com/tvsm/unified/utils/URLUtils.java`
(`RSA_TOKEN_USERNAME`, `RSA_TOKEN_PASSWORD`). The replacement does not use them.

## Toolchain

| Purpose | Tool | Where |
| --- | --- | --- |
| Java and Kotlin decompile | jadx 1.5.6 | `tools/apk-static.sh` |
| Resources and smali | apktool 3.0.3 | `tools/apk-static.sh` |
| Static risk and inventory report | MobSF v4.6.4 (docker) | `tools/mobsf-up.sh` |
| Native libraries | Ghidra 12.1.4 | `tools/ghidra-native.sh` |
| Ghidra from an AI client | GhidraMCP 2.0.0 | `mcp/ghidra-mcp.json` |
| Runtime instrumentation | frida-tools 17.26.1, objection 1.12.5 | device over usb |
| Traffic capture | mitmproxy 12.3.1 | device proxy to host |

Ghidra project paths must not contain a path element that starts with a dot, so
projects live in `~/ghidra-projects`, not under `.tmp/`.

## Runtime notes

The phone is connected over usb and is not rooted, so `frida-server` cannot run on
the device. Options:

- patch the apk with the frida-gadget and repackage it with `apktool b` plus
  `apksigner sign`
- use `objection` on a rooted emulator instead
- rely on the static analysis plus `mitmproxy` for the network behaviour

The apk is signed by TVS with a production key, so any repackaging invalidates the
signature and the app has to be uninstalled from the device first.
