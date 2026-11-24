import { decodePolyline, distanceAlongPath } from './polyline';

describe('polyline', () => {
    it('decodes a valhalla shape', () => {
        const points = decodePolyline('abbmT`onolCBoBi@}GoAoEoCiFsFyDB}', 6);
        expect(points.length).toBeGreaterThan(2);
        expect(points[0].lat).toBeCloseTo(11.241, 3);
        expect(points[0].lon).toBeCloseTo(-74.1947, 3);
    });

    it('measures the length in meters', () => {
        const points = decodePolyline('abbmT`onolCBoBi@}GoAoEoCiFsFyDB}BDkCwCIgs@{Bqq@aBgr@kB_k@}B}SgCmb@kGeCY{Zq@e\\{@mYmA_QQgk@u@gr@iAaEIcgAmD}p@uB}CuAho@wrAcDoDaBq@}@M_AMiAIsDfCcBj@m[nIci@vMeO`DaT`Fwc@`JaJiWoT`FsKyWmDkD}H}H{DwFwD_Kcj@|KsAyFuE{MwIqN{c@}d@pK_NfNqM~IsI`D{C|DeBnMiCq@cg@tOa@|VeFvUkK_FuK{CoKwAmM_@{\\A{YUwC', 6);
        const distances = distanceAlongPath(points);
        const meters = distances[distances.length - 1];

        expect(meters).toBeGreaterThan(2500);
        expect(meters).toBeLessThan(2750);
    });

    it('returns no length for an empty shape', () => {
        expect(distanceAlongPath([]).at(-1)).toBe(0);
    });
});
