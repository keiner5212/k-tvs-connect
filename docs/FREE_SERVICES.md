# Free map, search and routing

Everything the map needs runs without an account, without an api key and without a
card. The three service urls are settings, so you can move from the public
instances to your own Docker instance without touching the code.

## Map tiles and styles

OpenFreeMap serves the whole planet from the OpenMapTiles schema with no key, no
registration and no published request limit.

| Style | Url |
| --- | --- |
| Liberty | `https://tiles.openfreemap.org/styles/liberty` |
| Bright | `https://tiles.openfreemap.org/styles/bright` |
| Positron | `https://tiles.openfreemap.org/styles/positron` |

The map is rendered with `@maplibre/maplibre-react-native`, which has no Google
dependency. The project stays on the legacy architecture, so the version is pinned
to `10.4.2`, the last release that supports it. The tiles still need a unique
user agent, the app sends `K-Tvs-Connect/0.1`.

## Place search

Photon (komoot) answers with a typeahead search and needs no key:

```
https://photon.komoot.io/api/?q=<query>&limit=10&lat=<lat>&lon=<lon>&zoom=12
```

Two things the public instance does not tell you and that cost a day:

- **It needs the position as a bias.** Without `lat` and `lon` it answers with
  matches anywhere in the world. A search for "calle 10" came back with a street
  in Spain. The app sends the rider position and drops anything more than 100 km
  away.
- **It has no Spanish name data.** `lang=es` and `lang=es-ES` are refused with a
  400, only `en`, `de` and `fr` are accepted. The app does not send the parameter
  and uses the local names, which are Spanish anyway.

The policy is "be fair, extensive usage will be throttled", so the app spaces the
requests by a second. Do not build on the public Nominatim instance: it allows one
request per second, forbids client side autocomplete and expects a geocoding
application to run its own service.

## Routing

Valhalla is the routing engine of OpenStreetMap. It is used by the app for two
things that matter here:

- `motor_scooter` as the costing profile, so the route prefers the kind of road a
  scooter can use.
- `exclude_locations` and `exclude_polygons` at the root of the request, so a
  marked point is excluded by the engine itself. No polyline inspection and no
  detour waypoint needed on the client.

Request shape:

```json
{
  "locations": [{ "lat": 0, "lon": 0 }, { "lat": 0, "lon": 0 }],
  "language": "es-ES",
  "costing": "motor_scooter",
  "units": "kilometers",
  "exclude_locations": [{ "lat": 0, "lon": 0 }],
  "exclude_polygons": [[[0, 0], [0, 0], [0, 0], [0, 0]]]
}
```

Three things the public instance does not tell you:

- **The summary length comes back in kilometres** whatever the `units` parameter
  says. The distance has to be measured from the encoded shape, which is always in
  metres, with `src/utils/polyline.ts`.
- **`exclude_polygons` takes plain rings of coordinates, not GeoJSON objects.** A
  GeoJSON polygon is refused with a parse error.
- **An exclusion removes the whole road the point sits on.** When that makes the
  destination unreachable the router answers "no path could be found". The app
  then relaxes the request, first to the points only and then to no exclusion at
  all, and tells the rider that the cameras could not be avoided.

The FOSSGIS demo server `https://valhalla1.openstreetmap.de` is open to the public
with one request per second and asks published apps to send an `X-Client-Id`
header, which the app does.

## Running it locally

```sh
docker compose -f docker/docker-compose.valhalla.yml up -d
```

The first start downloads the region extract and builds the routing tiles, that
takes a while. After that set the routing url in Settings to
`http://127.0.0.1:8002` and the app never talks to the public instance again.

The same trick works for the tiles: point the map style url at a self hosted
tileserver-gl instance serving the same OpenMapTiles schema.

## What leaves the phone

The tile requests reveal the viewport. The geocoding request reveals the text
that was typed. The routing request reveals the origin, the destination and the
avoid points. Nothing else is sent: the frame number of the scooter, the bluetooth
address and the live telemetry never leave the device, and no TVS host is ever
contacted. `tools/verify-bundle.sh` fails the build if a TVS host reappears in the
bundle.
