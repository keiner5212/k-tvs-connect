# Workspace notes

- RE toolchain is user-local: Ghidra in `~/tools/ghidra_12.1.4_PUBLIC`, jadx in `~/tools/jadx-1.5.6`, Android SDK in `~/Android/Sdk`, CLI tools in `~/.local/bin`. Load it with `. tools/env.sh`.
- Ghidra 12.1.4 is pinned because the GhidraMCP 2.0 extension is built for that version. Ghidra needs JDK 21, the system default stays JDK 26.
- Ghidra rejects project paths that contain a path element starting with a dot. Projects live in `~/ghidra-projects`, never under `.tmp/`.
- Headless GhidraMCP HTTP server default port is 8082. The Ghidra plugin port is 8080.
- jadx takes JVM options through the `JADX_OPTS` env var, not as a CLI flag. Use `JADX_OPTS=-Xmx6g`.
- MobSF flow: upload with `POST /api/v1/upload`, then `POST /api/v1/scan` with the returned hash, then poll `POST /api/v1/report_json` with form data `hash=`. The API key is printed in the container log as `REST API Key:`.
- MobSF container is named `mobsf`, bound to `127.0.0.1:8000`. Restart with `docker start mobsf`.
- App stack follows the onconature reference: npm only, Expo SDK 54, expo-dev-client, nativewind 2 with no preset in tailwind.config.js.
- `unstable_transformImportMeta: true` is required in babel-preset-expo, otherwise zustand 5 fails to bundle on Hermes.
- App id is `com.ktvsconnect.app`, app name `K Tvs Connect`. Original app id is `com.tvsm.connect.latam`.
