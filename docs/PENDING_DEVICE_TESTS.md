# Device tests

Checked on the phone on 7 November 2026:

| # | Test | Result |
| --- | --- | --- |
| 1 | The place search | It answered with a street in Spain. The public geocoder was not biased by the position. Fixed, and it now answers with the streets of Santa Marta. |
| 2 | The route distance | The router reports the summary in kilometres whatever the units parameter says, and the app read it as metres. Fixed, the distance comes from the encoded shape. |
| 3 | The arrival estimate | It shows the arrival time and the reason next to it. |
| 4 | The shared location | The app opens on the map with the route to the shared point. |
| 5 | The screens | The safe area is respected on every screen that was opened. |
| 6 | The map sheet, the icons and the camera markers | All there, the eight operating cameras show on the map. |
| 7 | The icon | It shows on the launcher with a margin around the route. |

The rest needs the app switched on and close to the phone, so it is written down
instead of being guessed at. Each item says what to do, what to watch and what it
would prove.

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

Save a route, ride it three times and start it again.

- Prove: that the estimate becomes the average of the times taken, that the
  list of the times is on the saved route screens, that the ride starts and
  ends with one notification each, and that the explanation says where the
  number comes from.

### 8. The shared location

Share a place from Google Maps into the app.

- Prove: that the app opens on the map with the route from the current position
  to that exact point. The links are `geo:` uris and the https links the map
  apps use.

### 9. The screens

Open every screen and check the safe area with the gesture bar on and off:
Map, Settings, Cameras, Camera detail, Route details,
Connection, Cameras, Camera detail, Where to, Saved routes, Route preview, Route
details, Pin, Export, Delete, Permissions.

- Prove: that nothing hides under the status bar, the navigation bar, the tab
  bar or the keyboard.

### 10. The icon

Look at the launcher.

- Prove: that the icon has a visible margin inside the blue tile and that
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
  how it will be used on the app.
