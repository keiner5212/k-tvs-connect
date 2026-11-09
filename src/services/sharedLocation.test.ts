import { parseSharedLocation } from './sharedLocation';

describe('parseSharedLocation', () => {
    it('reads a geo uri with the coordinates', () => {
        const place = parseSharedLocation('geo:11.2407,-74.1947');

        expect(place).not.toBeNull();
        expect(place?.latitude).toBeCloseTo(11.2407, 4);
        expect(place?.longitude).toBeCloseTo(-74.1947, 4);
    });

    it('reads a geo uri with a query', () => {
        const place = parseSharedLocation('geo:0,0?q=11.2407,-74.1947');

        expect(place?.latitude).toBeCloseTo(11.2407, 4);
        expect(place?.longitude).toBeCloseTo(-74.1947, 4);
    });

    it('reads a geo uri with a label and the coordinates', () => {
        const place = parseSharedLocation('geo:0,0?q=11.2407,-74.1947(Playa Rodadero)');

        expect(place?.latitude).toBeCloseTo(11.2407, 4);
        expect(place?.name).toBe('(Playa Rodadero)');
    });

    it('reads a google maps link', () => {
        const place = parseSharedLocation(
            'https://www.google.com/maps/search/?api=1&query=11.2407,-74.1947',
        );

        expect(place?.latitude).toBeCloseTo(11.2407, 4);
        expect(place?.longitude).toBeCloseTo(-74.1947, 4);
    });

    it('reads a google maps link with the destination parameter', () => {
        const place = parseSharedLocation('https://maps.google.com/?daddr=11.2407,-74.1947');

        expect(place?.latitude).toBeCloseTo(11.2407, 4);
    });

    it('reads the app scheme', () => {
        const place = parseSharedLocation('kroutes://route?lat=11.2407&lon=-74.1947');

        expect(place).toBeNull();
    });

    it('rejects a link without coordinates', () => {
        expect(parseSharedLocation('geo:0,0?q=Santa Marta')).toBeNull();
        expect(parseSharedLocation('https://maps.google.com/')).toBeNull();
        expect(parseSharedLocation('')).toBeNull();
    });

    it('rejects the null island', () => {
        expect(parseSharedLocation('geo:0,0?q=0,0')).toBeNull();
    });

    it('rejects coordinates out of range', () => {
        expect(parseSharedLocation('geo:200,300')).toBeNull();
    });

    it('keeps a name without coordinates out of the way', () => {
        const place = parseSharedLocation('geo:0,0?q=Casa&ll=11.24,-74.19');
        expect(place?.latitude).toBeCloseTo(11.24, 4);
    });
});
