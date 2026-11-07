# Reverse engineering notes

Target: `com.tvsm.connect.latam`, "TVS Connect - LATAM", versionCode 44, versionName 4.4.0.
minSdk 28, targetSdk 35, compileSdk 36. Native code only in the arm64-v8a split.

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

## Toolchain

| Purpose | Tool | Where |
| --- | --- | --- |
| Java/Kotlin decompile | jadx 1.5.6 | `tools/apk-static.sh` |
| Resources and smali | apktool 3.0.3 | `tools/apk-static.sh` |
| Static risk and inventory report | MobSF v4.6.4 (docker) | `tools/mobsf-up.sh` |
| Native libraries | Ghidra 12.1.4 | `tools/ghidra-native.sh` |
| Ghidra from an AI client | GhidraMCP 2.0.0 | `mcp/ghidra-mcp.json` |
| Runtime instrumentation | frida-tools 17.26.1, objection 1.12.5 | device over USB |
| Traffic capture | mitmproxy 12.3.1 | device proxy to host |

Ghidra project paths must not contain a path element that starts with a dot, so
projects live in `~/ghidra-projects`, not under `.tmp/`.

## Architecture of the original app

- 17 dex files, React Native style split between Java and Kotlin code.
- Vehicle connectivity goes through `libBluConnect-Lib.so`, the TVS BLE stack.
- Voice assistant: Cerence (`libcerence_ark_core.so`), ARK engine
  (`libark_conversation_engine.so`), ASR (`libnds_asr5.so`), TTS (`libnds_tts*.so`).
- Maps: HERE (`libheresdk.so`, 66 MB), MapmyIndia / Mappls (`libmappls-gl.so`).
- Backend: `tvsconnectapi.tvsmotor.com`, plus the P360 platform on `p360.tvsmotor.com`
  and a CDP GraphQL endpoint on `cdpcom-dev.tvsmotor.com`.
- Telemetry is pushed to an Azure Service Bus topic, `dev-tvsm-telemetry-event-hub`.

The recovered endpoints are in [API_CONTRACT.md](API_CONTRACT.md).

## Vehicle connectivity

The BLE link to the vehicle is not HTTP. It is the third party Aptener BluConnect SDK
(`com.aptener.bluconnect`, native `libBluConnect-Lib.so`) plus the TVS layer on top of
it (`com/tvsm/connect/bluetooth/**`, `com/tvsm/ev/bluetooth/**`,
`com/tvsm/unified/ui/fragment/UnifiedBluetooth*`).

The native library exports only two JNI symbols,
`Java_com_aptener_bluconnect_BluConnectServiceImpl_loadConfig` and
`Java_com_aptener_bluconnect_di_module_FirebaseModule_Companion_FirebaseAppFactory_loadConfig2`.
The rest registers dynamically in `JNI_OnLoad`, and the service and characteristic UUIDs
are not literal strings in the binary: the SDK loads its configuration at runtime
through `loadConfig`. The protocol details live in the server supplied config and in
the obfuscated native code, not in readable constants.

The Ghidra project is `~/ghidra-projects/TVSConnect`, built with
`tools/ghidra-native.sh`. The headless MCP bridge was verified against it:
`get_program_info` reports `AARCH64:LE:64:v8A` and `search_functions_by_name` with
query `Java_` returns the two symbols above.

## Runtime notes

The phone is not rooted, so `frida-server` cannot be started on the device.
Options:

- patch the APK with the frida-gadget and repackage it with `apktool b` plus
  `apksigner sign`
- use `objection` on a rooted emulator instead
- rely on the static analysis plus `mitmproxy` for the network behaviour

The APK is signed by TVS with a production key, so any repackaging invalidates the
signature and the app has to be uninstalled from the device first.
