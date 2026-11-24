# K Routes

A personal route planner for the phone. It plans a route for a scooter, it
avoids the photo detection cameras the authority published and the points the
rider marked as unwanted, and it follows the ride on the map with the position
of the phone. No account, no server of our own, nothing leaves the device
except the routes and the searches that need it.

| | |
| --- | --- |
| Stack | Expo SDK 54, React Native 0.81.5, React 19.1, TypeScript strict |
| Application id | `com.kroutes.app` |
| Map | MapLibre React Native with OpenFreeMap styles, no key |
| Search and routing | Google Geocoding and Valhalla |
| Storage | expo-sqlite with SQLCipher, the key in the android keystore |
| Build | release apk from the local gradle build, no EAS |

## Features

- **Map** with the position of the phone, a follow mode, place search, routes
  for a scooter profile, points to avoid that are stored on the device and that
  the routing engine excludes by itself, and saved routes that can be renamed,
  deleted and replayed along their line.
- **Photo detection cameras**: the ANSV list of authorised cameras is fetched
  and the operating ones become automatic points to avoid, with the speed the
  authority published and the infractions it declared for each one.
- **Follow the route**: the app watches the position of the phone and shows the
  next turn, the distance that is left and the time of arrival.
- **Arrival time that learns**: the estimate starts from the router and moves
  towards the times this rider actually took on that route, with the reason
  shown next to it.
- **Shared places**: a location shared from another map app opens the route to
  that exact point from where the rider is.
- **Settings** for units, the map style, the camera radius, the service urls, a
  local pin, data export and data deletion.

## The maps key

The app reads the google key from the gitignored `.env.local` as
`EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`. The key is restricted on the google side to
the android application `com.kroutes.app`, to the sha1 of the signing
certificate and to the apis it may call. When the key is re-restricted, the
package name in `src/config/geocoding.ts` has to follow.

## Run it

```sh
npm install
npm run android          # build and install on the connected phone
```

The app needs a development client, Expo Go does not carry the native map. See
[docs/SETUP.md](docs/SETUP.md).

## Build the apk

```sh
./android/gradlew -p android assembleRelease
adb install -r android/app/build/outputs/apk/release/app-release.apk
tools/verify-bundle.sh android/app/build/outputs/apk/release/app-release.apk
```

The verify step fails the build if a TVS host or a vendor credential reappears
in the bundle.

## Run the routing locally

```sh
docker compose -f docker/docker-compose.valhalla.yml up -d
```

Then point the routing url in Settings at `http://127.0.0.1:8002` and nothing
leaves the machine any more.

## Documentation

| Document | Content |
| --- | --- |
| [docs/SETUP.md](docs/SETUP.md) | Install, run, the builds |
| [docs/PROJECT_STRUCTURE.md](docs/PROJECT_STRUCTURE.md) | Folder map and boundaries |
| [docs/FREE_SERVICES.md](docs/FREE_SERVICES.md) | Tiles, search and routing without a key |
| [docs/ANSV_CAMERAS.md](docs/ANSV_CAMERAS.md) | The camera dataset, the active rule and what the app shows |
| [docs/ARRIVAL_ESTIMATE.md](docs/ARRIVAL_ESTIMATE.md) | The arrival estimate and how it learns |
| [docs/PENDING_DEVICE_TESTS.md](docs/PENDING_DEVICE_TESTS.md) | What still needs the phone |

Conventions live in [AGENTS.md](AGENTS.md).
