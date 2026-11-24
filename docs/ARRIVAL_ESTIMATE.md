# Arrival time estimate

The app shows an arrival time on the map. A saved route keeps the time the
router gave when it was saved and the list of the times the rider really took
on it. The estimate is the average of those times.

## The formula

```
R = the router duration of the route when it was saved, in seconds
T_1 .. T_n = the times the rider took on the route, in seconds

n = 0:  estimate = R
n > 0:  estimate = round( sum(T_i) / n )
```

It is a plain arithmetic mean, with no recency weight and no time of day
buckets: a route is a route, and the pace of one rider on one route does not
drift on the timescale of the list.

While the rider is on the route, the time that is left is the estimate scaled
by the distance that is left:

```
time_left = estimate * distance_left / distance
```

## What is stored

| Table | What |
| --- | --- |
| `routes.duration_seconds` | the time the router gave when the route was saved, the initial estimate |
| `routes.achieved_times` | the list of the times the rider took, the newest first |

The times belong to the route itself. A route that was computed and never
saved keeps nothing: it shows the router answer.

## What is rejected

A ride is stored only when it can be the time this rider took on this route:

| Check | Band | Why |
| --- | --- | --- |
| ride time | 60 s to 6 h | below is a jump of the position, above is a forgotten ride |
| distance ratio | 0.85 to 1.15 | the rider has to have done most of the route |
| pace | 8 to 90 km/h | the time and the distance have to describe the same ride |

A ride that fails is not stored. It never becomes evidence.

## How the start and the end are detected

Both use a margin of 10 m, because the position of the phone is not exact.

- The ride starts when the rider has moved 10 m from the point where they
  pressed start. The clock of the route starts there, not at the button, so
  the minutes spent getting on the bike are not learned as riding time.
- The ride ends when the rider is within 10 m of the destination, or when the
  route has less than 10 m left, because a place can be a few metres off the
  road.

The two margins shrink the measured time by 20 m of riding, which is 1.7% on
a 1.2 km route and 0.1% on a 25 km one.

## Where it is explained

- The map sheet shows the distance that is left, the time that is left and the
  arrival time.
- The saved routes list shows the estimate and how many times the route was
  ridden.
- The route details screen says where the number comes from: "Your average of
  3 rides." or "The map's estimate."
- The phone gets two notifications: one when the ride starts and one when the
  rider arrives.
