# Photo detection cameras

The app pulls the Colombian road safety agency list of authorised photo-detection
cameras and turns the operating ones into automatic avoid points.

## The data

| | |
| --- | --- |
| File | `https://fotodeteccion.ansv.gov.co/map/data/sast.json` |
| Size | about 4.5 MB, `Cache-Control: public, max-age=604800` |
| Auth | none, no key, no headers |
| Published by | Agencia Nacional de Seguridad Vial (ANSV) |
| Public map | `https://fotodeteccion.ansv.gov.co/map/ubicaciones-aprobadas.html` |

The file is the machine readable source behind the official map. The map itself only
renders the raw infraction codes, and no published legend for those codes was found
in the resolution, the criteria workbooks, the user manual or the map script. The
app therefore reports the codes verbatim and does not guess what they mean.

## Shape

```
{ "timestamp": <epoch seconds>, "results": [
  { "estado": "Aprobada", "departamento": "...", "municipio": "...",
    "ubicaciones": [
      { "codigo_unico": "CU000000000090", "tipo_tramo": "Nacional",
        "tipo_tecnologia": "Radar Doppler",
        "estado_operacion": "Operando",
        "latitud": 6.2433, "longitud": -75.6025,
        "direccion": "Calle 22 con Carrera 19",
        "velocidad_maxima_permitida": "50",
        "lista_infracciones": ["C14", "C24", "C35", "D02"],
        "senales": [ { "id": 442, "estado": "Instalada", "activo": true, ... } ] } ] } ] }
```

## Which cameras are active

`estado_operacion` decides it. The running ones and the expired ones are in the
app, because an expired camera is usually still on the road:

| Value | Count | Treated as |
| --- | --- | --- |
| `Operando` | 374 | operating, shown in red |
| `Renovada - Expirada` | 292 | expired, shown in orange and avoided |
| `Vencida` | 164 | expired, shown in orange and avoided |
| `Prorrogada - Vencida` | 79 | expired, shown in orange and avoided |
| `Autorizada instalar` | 430 | authorised but not installed yet, not in the app |
| `Autorizada - Desistida` | 3 | withdrawn, not in the app |

The same equipment appears in the list of two jurisdictions and the two entries
do not always carry the same state. The entry that is running wins, because
that is the one that can fine the rider.

The `activo` flag on each `senal` is true for every signal in the file, so it does not
discriminate anything. An unknown `estado_operacion` is treated as not operating.

## The sense of the camera

The agency writes the sense of the camera inside the free text of its address:
`Sentido Sur - Norte`, `sentidos NORTE - SUR`, `(N-S)`, `sentido OCC ORI`.

The pair is written in the direction of the traffic the equipment watches: the
traffic comes from the first place and goes to the second one. The warning signs
of the camera are placed on that first side, which is what confirms the reading.

A camera that watches one sense photographs the vehicles that come towards it,
so it sees their front. The rider that goes the other way leaves the camera
behind and it photographs the plate. The app therefore only avoids a camera when
the route goes in the direction the camera watches, and leaves the rest alone.

The sense is only published for 413 of the cameras. The others are avoided in
every direction, which is the safe answer.

## What the app stores

| Table | What |
| --- | --- |
| `cameras` | one row per camera, keyed by `codigo_unico`, with the snapshot id |
| `camera_preferences` | the per camera on/off choice, so a refresh cannot resurrect a camera you turned off |
| `avoid_points` | only the points you drop yourself, never the cameras |

The import runs in one transaction: it upserts the rows of the new snapshot and then
deletes the rows of the older ones, so a camera that stops operating stops being
avoided. A failed or partial import keeps the previous snapshot.

The dataset is refreshed at most every 7 days, which is the freshness the server
publishes in its own cache header.

## How the avoid points work

The route is computed twice. The first one has no cameras, so it is the shortest
way to the destination, and it shows which way the rider goes through every
street. The cameras near that route, within 40 m of it, are then split in two:
the ones that watch the traffic the rider goes against, and the ones that watch
the other way. Only the first group goes to the routing service as an exclusion,
with a 25 m radius, so the route only leaves the spot of the camera and not the
streets around it.

The second request is the route the rider gets. The map tells how many cameras
were avoided and how many nearby ones were left alone because they watch the
other way.

The exclusion radius used to be 100 m and the corridor a straight line between
the two ends. With that, the router answered "no path could be found" and the
app fell back to avoiding half of the cameras, and the routes came out much
longer than the road.

## What the app says about each camera

- The address the authority published, and the municipality and department.
- The maximum speed the authority published, in km/h. Most cameras have no speed
  published, and the app says "Speed not published" rather than guessing.
- The technology, in plain words, with the official term next to it.
- The infraction codes the authority declared for that camera, verbatim. A button
  opens the wording of those codes, and the card itself only carries the codes.
- The date the dataset was published.

The app never shows a fine amount and never presents the data as a live statement of
the law. The source is credited on every card:

> Source: Agencia Nacional de Seguridad Vial (ANSV). Data published 12 Mar 2025.

## House rules

- The dataset url is a compile time constant, never a settings value, so it cannot be
  pointed somewhere else.
- The request carries no query parameters, so no location, route or camera choice
  leaves the phone.
- Free text from the dataset is stripped of control characters and bidi overrides and
  capped before it is stored, and it is never used as a log field or in an export.
- The dataset is used on the device. It is not republished.
