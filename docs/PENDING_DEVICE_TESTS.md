# Device tests still pending

Everything below needs the phone and the bike, so it is written down instead of
being guessed at. Each item says what to do, what to watch and what it would
prove.

## The bike

### 1. The real frames

Turn the bike on, keep it within range of the phone and open the app.

- Watch: `adb logcat -s ReactNativeJS | grep frame`
- Prove: that the frames arrive decrypted, that the offsets in
  `src/ble/frames.ts` match the bytes, and that the switch bit order is right.

Until this is done, the telemetry on the dashboard is a port of the original
app's tables, not a verified reading of the bike.

### 2. The packets to the cluster

With the bike connected, send the destination to it from the route sheet.

- Watch: `adb logcat -s ReactNativeJS | grep ble_write`
- Prove: that the cluster accepts the address packet and shows the route on its
  own display.

Then check the clock on the cluster: the mobile data packet carries the phone
time and it is refreshed every two seconds.

### 3. The rider name

The name the cluster shows comes from the nickname of the bike in the Garage.

- Prove: that the cluster shows that name and not something truncated or full of
  X characters. The cluster only accepts latin letters, digits and spaces, so a
  nickname with accents becomes X.

### 4. The notifications

The original app does not send notification text to the cluster. It sends only
the WhatsApp, Facebook and Instagram counters and the media metadata. If the
cluster is expected to show a message, that is not what the official app does.

## The phone

### 5. The place search

Search for a street that exists in more than one city.

- Prove: that the results are the ones near the rider and not the ones in
  Panama. The geocoder is biased by the current position and anything further
  than 100 km is dropped.

### 6. The route distance

Compute a route of a known length.

- Prove: that the distance shown is in kilometres and not the kilometres read
  as metres. The router reports the summary in kilometres whatever the units
  parameter says, so the app measures the encoded shape instead.

### 7. The arrival estimate

Ride the same route three times.

- Prove: that the arrival time moves towards the times actually taken, and
  that the explanation says where the number comes from.

### 8. The shared location

Share a place from Google Maps into the app.

- Prove: that the app opens on the map with the route from the current position
  to that exact point. The links are `geo:` uris and the https links the map
  apps use.

### 9. The screens

Open every screen and check the safe area with the gesture bar on and off:
Garage, Dashboard, Map, Settings, Add bike, Edit bike, Bike details,
Connection, Cameras, Camera detail, Where to, Saved routes, Route preview, Route
details, Pin, Export, Delete, Permissions.

- Prove: that nothing hides under the status bar, the navigation bar, the tab
  bar or the keyboard.

### 10. The icon

Look at the launcher.

- Prove: that the scooter has a visible margin inside the green tile and that
  nothing is clipped by the system mask.

## The build

### 11. The Docker apk

```sh
bash tools/build-apk.sh
```

- Prove: that the image builds from a clean checkout with the pinned versions
  and that `tools/verify-bundle.sh` passes on the bundle inside it.

### 12. The release build

```sh
npx expo run:android --variant release
```

- Prove: that the app runs without Metro and without the dev client, which is
  how it will be used on the bike.
