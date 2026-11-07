# K Tvs Connect

A personal React Native companion for your own scooter. It talks to the bike over
Bluetooth LE with the protocol recovered from the original TVS Connect app, and it
uses free map services. No account, no server of our own, no TVS backend is ever
contacted.

| | |
| --- | --- |
| Stack | Expo SDK 54, React Native 0.81.5, React 19.1, TypeScript strict |
| Application id | `com.ktvsconnect.app` |
| Map | MapLibre React Native with OpenFreeMap styles, no key |
| Search and routing | Photon and Valhalla, no key, no account |
| Storage | expo-sqlite with SQLCipher, the key in the android keystore |
| Build | debug apk from Docker, no EAS |

## Icon

The launcher icon follows the family of the original app, a green tile with a grid and
a white glyph, but the glyph is our own: a scooter. The sources are an svg rendered
with sharp, the output goes to `src/assets/images`.

```sh
npx expo prebuild --clean    # the native resources need to pick the new assets up
```

## Features

- **Garage** with full CRUD: add a scooter by scanning for it or by typing its
  bluetooth address, edit the name, model and frame number, delete it, pick the
  active one. A duplicate address is rejected.
- **Connection** that reconnects on its own while the bike is on, with a scan
  window, a liveness watchdog and a visible age on every value.
- **Dashboard** with speed, engine rpm, fuel, odometer, average and top speed,
  throttle, the trip block (distance, time, mileage, fuel, range, gear, engine
  temperature, lean angle, lap and best lap), the recorded rides of the week and
  the alerts for low fuel, side stand, turn signals and overspeed.
- **Map** with the position of the phone and a follow mode, place search, routes
  for a scooter profile, points to avoid that are stored on the device and that the
  routing engine excludes by itself, and saved routes that can be renamed,
  deleted and replayed along their line.
- **Settings** for units, the overspeed limit, the map style, the service urls,
  a local pin, data export and data deletion.

## Run it

```sh
npm install
npm run android          # build and install on the connected phone
```

The app needs a development client, Expo Go does not carry bluetooth or the
native map. See [docs/SETUP.md](docs/SETUP.md).

## Build the apk in Docker, no EAS

```sh
tools/build-apk.sh
adb install -r build/app-debug.apk
tools/verify-bundle.sh build/app-debug.apk
```

The image pins the sdk components React Native 0.81 expects. The verify step fails
the build if a TVS host or a vendor credential reappears in the bundle.

## Run the routing locally

```sh
docker compose -f docker/docker-compose.valhalla.yml up -d
```

Then point the routing url in Settings at `http://127.0.0.1:8002` and nothing
leaves the machine any more.

## Documentation

| Document | Content |
| --- | --- |
| [docs/SETUP.md](docs/SETUP.md) | Install, run, the Docker builds |
| [docs/PROJECT_STRUCTURE.md](docs/PROJECT_STRUCTURE.md) | Folder map and boundaries |
| [docs/BLE_PROTOCOL.md](docs/BLE_PROTOCOL.md) | The scooter protocol and the port in `src/ble` |
| [docs/FREE_SERVICES.md](docs/FREE_SERVICES.md) | Tiles, search and routing without a key |
| [docs/REVERSE_ENGINEERING.md](docs/REVERSE_ENGINEERING.md) | What the original app does and how it was found |

Conventions live in [AGENTS.md](AGENTS.md).

## Reverse engineering toolchain

| Tool | Version | Path |
| --- | --- | --- |
| Ghidra | 12.1.4 | `~/tools/ghidra_12.1.4_PUBLIC` |
| GhidraMCP | 2.0.0 | `~/.local/bin/ghidra-mcp`, extension in `~/.config/ghidra/ghidra_12.1.4_PUBLIC/Extensions/GhidraMCP` |
| jadx | 1.5.6 | `~/.local/bin/jadx` |
| apktool | 3.0.3 | `~/.local/bin/apktool` |
| Android SDK | build-tools 36.0.0, platform 36, platform-tools 37.0.1 | `~/Android/Sdk` |
| MobSF | v4.6.4 image | container `mobsf`, `http://127.0.0.1:8000` |
| frida-tools | 17.26.1 | `~/.local/bin/frida`, `frida-ps`, `frida-trace` |
| objection | 1.12.5 | `~/.local/bin/objection` |
| mitmproxy | 12.3.1 | `~/.local/bin/mitmproxy`, `mitmdump` |
| JDK for Ghidra | 21.0.2 | `~/.jabba/jdk/openjdk@21.0.2` |

Ghidra 12.1.4 is pinned because the GhidraMCP 2.0 extension is built for it.

Load the environment before using the scripts:

```sh
. tools/env.sh
```

### Workflow

```sh
tools/xapk-unpack.sh com.tvsm.connect.latam-44_arm64-v8a.xapk .tmp/target
tools/apk-static.sh .tmp/target/base.apk .tmp/target/static
tools/mobsf-up.sh .tmp/target/base.apk .tmp/target/mobsf
tools/ghidra-native.sh .tmp/target/split_config.arm64_v8a.apk TVSConnect
tools/ghidra-mcp-http.sh .tmp/target/tvs-lib/arm64-v8a/libBluConnect-Lib.so 8082
```

The MCP client config for the AI client is in [mcp/ghidra-mcp.json](mcp/ghidra-mcp.json).

Ghidra rejects project paths that contain a path element starting with a dot, so
projects live in `~/ghidra-projects` and not in `.tmp/`.

## Scope and legality

Reverse engineering for interoperability or personal use of an app you have the
right to inspect is fine. This project contains no original code, no original
artwork and no original assets, and it never contacts the vendor backend. Do not
redistribute the original app and do not ship the original package name.
