# Setup

## What you need

- The phone connected over usb with usb debugging on
- Node 20.19.4 or newer, npm only, never pnpm or yarn
- JDK 21 for the native build (the workspace keeps it in `~/.jabba/jdk/openjdk@21.0.2`)

## Install on the phone

```sh
npm install
npm run android
```

That command regenerates the native project when needed, builds the debug app with
gradle, installs it on the connected phone and starts the metro bundler. The app
opens on the phone and connects to the bundler over usb.

The first build downloads gradle and the android dependencies, it takes a few
minutes. Later builds are much faster.

If you change the plugins in `app.json`, run `npx expo prebuild --clean` before the
next build.

### Without metro

The debug app needs the bundler running. To keep it running in another terminal:

```sh
npm start
```

and then open the app on the phone.

## Build the apk in Docker, no EAS

```sh
tools/build-apk.sh
adb install -r build/app-debug.apk
tools/verify-bundle.sh build/app-debug.apk
```

The image pins the sdk components React Native 0.81 expects: platform 36, build
tools 36.0.0, ndk 27.1.12297006 and cmake 3.30.5. The first build downloads the
image, the ndk and gradle, the layers are cached afterwards.

The verify step fails the build if a TVS host or a vendor credential reappears in
the bundle.

## First run on the phone

1. Open the app. The development client shows its own welcome sheet the first
   time, tap **Continue** to close it.
2. Go to **Garage** and tap **Add scooter**.
3. Turn the scooter on and tap **Scan for scooters**. The phone asks for the
   bluetooth permission the first time. The bike shows up as a bluetooth device,
   tap it to fill the address. Or type the address yourself.
4. Fill the name and the frame number, then **Add scooter**.
5. The scooter becomes the active one. Go to **Dashboard** and turn the ignition
   on: the app connects on its own and the live values start to arrive.

## Local routing service

```sh
docker compose -f docker/docker-compose.valhalla.yml up -d
```

Then set the routing url in Settings to `http://127.0.0.1:8002`. See
[FREE_SERVICES.md](FREE_SERVICES.md).

## Checks

```sh
npm run lint
npm run typecheck
npm test
```

The tests cover the bluetooth frame parser against the offset tables recovered from
the original app, and the polyline maths used for the routes.

## Reverse engineering toolchain

The scripts under `tools/` need the toolchain described in the root `README.md`.
Load it into the shell before using them:

```sh
. tools/env.sh
```
