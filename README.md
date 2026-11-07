# K Tvs Connect

React Native replacement client for the TVS Connect Android app, plus the
reverse engineering toolchain used to recover its API contract.

The repository holds two things:

- `src/`, `App.tsx` and the root config files: the Expo app (development client, not Expo Go).
- `tools/`, `mcp/` and `docs/`: the analysis workspace for the original XAPK.

`docs/API_CONTRACT.md` holds the endpoints recovered from the original app.
`docs/REVERSE_ENGINEERING.md` holds the findings and the toolchain notes.

## The app

| | |
| --- | --- |
| Stack | Expo SDK 54, React Native 0.81.5, React 19.1, TypeScript strict |
| Application id | `com.ktvsconnect.app` |
| Run | `npm start` starts the dev client, `npm run android` builds and installs |
| Checks | `npm run lint`, `npm run typecheck`, `npm test` |

Conventions live in [AGENTS.md](AGENTS.md). Setup in [docs/SETUP.md](docs/SETUP.md).

```sh
npm install
npm run android
```

## Reverse engineering toolchain

| Tool | Version | Path |
| --- | --- | --- |
| Ghidra | 12.1.4 | `~/tools/ghidra_12.1.4_PUBLIC` |
| GhidraMCP | 2.0.0 | `~/.local/bin/ghidra-mcp`, extension in `~/.config/ghidra/ghidra_12.1.4_PUBLIC/Extensions/GhidraMCP` |
| jadx | 1.5.6 | `~/.local/bin/jadx` |
| apktool | 3.0.3 | `~/.local/bin/apktool` |
| Android SDK | build-tools 36.0.0, platform 36, platform-tools 37.0.1 | `~/Android/Sdk` |
| MobSF | v4.6.4 image | container `mobsf`, `http://127.0.0.1:8000`, login `mobsf`/`mobsf` |
| frida-tools | 17.26.1 | `~/.local/bin/frida`, `frida-ps`, `frida-trace` |
| objection | 1.12.5 | `~/.local/bin/objection` |
| mitmproxy | 12.3.1 | `~/.local/bin/mitmproxy`, `mitmdump` |
| JDK for Ghidra | 21.0.2 | `~/.jabba/jdk/openjdk@21.0.2` |

Ghidra 12.1.4 is pinned because the GhidraMCP 2.0 extension is built for it.
Ghidra needs JDK 21 or newer, the rest of the system keeps its default JDK 26.

Load the environment before using the scripts:

```sh
. tools/env.sh
```

It exports `GHIDRA_INSTALL_DIR`, `ANDROID_HOME`, `GHIDRA_PROJECTS`, `JAVA_HOME` and the
`PATH` entries for every tool above.

## Workflow

### 1. Unpack the XAPK

```sh
tools/xapk-unpack.sh com.tvsm.connect.latam-44_arm64-v8a.xapk .tmp/target
```

Prints the package name, version and every split, then lists the APK parts. The base
APK is what jadx, apktool and MobSF need.

### 2. Static analysis

```sh
tools/apk-static.sh .tmp/target/base.apk .tmp/target/static
```

Runs `aapt2 dump badging`, `apksigner verify --print-certs`, lists native libraries,
decompiles with jadx into `jadx/` and decodes resources and smali with apktool into
`apktool/`.

### 3. MobSF report

```sh
tools/mobsf-up.sh .tmp/target/base.apk .tmp/target/mobsf
```

Uploads through the MobSF REST API, starts the static analysis and writes
`report.json` plus `report.pdf`. The API key is read from the container log on every
run, so recreating the container does not break the script.

Start MobSF again after a reboot:

```sh
docker start mobsf
```

### 4. Native libraries in Ghidra

```sh
tools/ghidra-native.sh .tmp/target/split_config.arm64_v8a.apk TVSConnect
```

Imports every `lib/*/*.so` into the Ghidra project `~/ghidra-projects/TVSConnect`.

Ghidra rejects project paths that contain a path element starting with a dot, so
projects live in `~/ghidra-projects` and not in `.tmp/`.

### 5. Ghidra over MCP

GUI mode:

```sh
~/tools/ghidra_12.1.4_PUBLIC/ghidraRun
```

Open the project, then `File > Configure > Developer > GhidraMCPPlugin`, and set the
port in `Edit > Tool Options > GhidraMCP HTTP Server` (default 8080).

Headless mode, no GUI needed:

```sh
tools/ghidra-mcp-http.sh .tmp/target/lib/arm64-v8a/libBluConnect-Lib.so 8081
```

MCP client config for both modes is in [mcp/ghidra-mcp.json](mcp/ghidra-mcp.json).
The `ghidra` entry is the stdio server to register in the AI client, the
`ghidra-headless` entry starts its own Ghidra instance.

Verified end to end: `initialize` then `tools/call get_program_info` returned the
program metadata and the function count through the headless bridge.

### 6. Dynamic analysis on the device

The phone is connected over USB and is not rooted, so `frida-server` cannot run on
the device. Options are the frida-gadget patched into the APK, a rooted emulator,
or static analysis plus `mitmdump` for the network behaviour.

```sh
adb devices -l
mitmdump --listen-host 0.0.0.0 --listen-port 8080
frida-ps -U
objection -U -G com.tvsm.connect.latam explore
```

## Scope and legality

Reverse engineering for interoperability or personal use of an app you have the right
to inspect is fine. Do not redistribute the original app code, resources, artwork or
signing keys, and do not ship the original package name. Clean room the replacement:
the React Native app contains its own code and talks to the same public endpoints.
