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

The search goes to Google Maps Platform, with a key that is restricted on the
google side to the apis it may call, to the package name of the app and to the
certificate that signs the apk. The key lives in the gitignored `.env.local` as
`EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`, never in the repository.

The key has to allow **both** apis below. With only the geocoding api allowed
the search answers for street addresses but not for a category, and the answer
for "gasolinera" is the country and not a station.

Two apis answer, in this order:

- **Places API (New) text search**, `POST https://places.googleapis.com/v1/places:searchText`.
  This is the one that finds a business or a category, so "gasolinera" returns
  the stations around the rider. It needs a `locationBias` circle around the
  rider, otherwise the answer is for the wrong city.
- **Geocoding API**, `GET https://maps.googleapis.com/maps/api/geocode/json`.
  The fallback, and the one that answers for a plain street address.

Both calls carry `X-Android-Package` and `X-Android-Cert`. Google only accepts
a request that identifies the app, and a plain fetch from react native does not,
so a request without those headers comes back as `REQUEST_DENIED`.

What the free tier allows, per month: **10.000** geocoding requests (Essentials)
and **5.000** places text searches (Pro, because the answer carries the name, the
address and the position). The 1.000 requests of the "Compute Routes Enterprise"
sku are the two wheeler routing, and the app does not use google for routing.

Three things that cost quota, and how the app avoids them:

- **Every prefix of a typed text is a different request.** A 30 character
  address is up to 30 billed requests and no two share a cache entry. The app
  waits 600 ms and asks from 5 characters, and it stops after 100 requests in a
  day.
- **The same text asked again is free.** Every answer is kept in the encrypted
  database for 24 hours, keyed by the text, the country and the cell of the
  rider position, so a repeated search never leaves the phone. An answer with
  no matches is kept too, so a text that finds nothing is not asked again.
- **A denied request is not an answer.** Google answers a refusal with http
  200 and a status, so the app reads the status and never caches a refusal as
  "no places found".

Google allows the coordinates of an answer to be kept for 30 days and the place
id forever. The cache holds 24 hours. The saved routes keep the destination
coordinates with no expiry, which is the one place where the 30 day rule is not
met yet.

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

The tile requests reveal the viewport. The search request reveals the text that
was typed and the approximate position of the rider, and it goes to Google Maps
Platform in the United States under the google terms. The routing request reveals
the origin, the destination and the avoid points. Nothing else is sent: the frame
number of the scooter, the bluetooth address and the live telemetry never leave
the device, and no TVS host is ever contacted. `tools/verify-bundle.sh` fails
the build if a TVS host or a foreign google key reappears in the bundle.
