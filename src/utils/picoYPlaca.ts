import { COLOMBIA_HOLIDAYS_2026, PICO_Y_PLACA_CITIES, PicoYPlacaCity } from '@config/picoYPlaca';

export type PicoYPlacaKind = 'no-plate' | 'no-data' | 'not-today' | 'later' | 'now';

export interface PicoYPlacaResult {
    kind: PicoYPlacaKind;
    /** the city the rule belongs to */
    city: string | null;
    /** the plate the rule was read for */
    plate: string | null;
    /** the first hour of the restriction */
    from?: number;
    /** the hour the restriction ends */
    to?: number;
    /** what the rider has to know about the city */
    note?: string;
}

export const normalizePlate = (value: string): string =>
    value.toUpperCase().replace(/[^A-Z0-9]/g, '');

/** a colombian motorcycle plate is three letters, two numbers and a letter */
export const isValidPlate = (value: string): boolean =>
    /^[A-Z]{3}\d{2}[A-Z]$/.test(normalizePlate(value));

/** the plate as it is written, three letters, two numbers and a letter */
export const formatPlate = (value: string): string => {
    const clean = normalizePlate(value);
    return clean.length > 3 ? `${clean.slice(0, 3)} ${clean.slice(3)}` : clean;
};

/**
 * The number of the plate that the restriction reads. A motorcycle plate has
 * two numbers and a letter at the end, so the last one is the one before the
 * letter.
 */
const restrictionNumber = (plate: string, digit: 'firstNumber' | 'lastNumber'): number => {
    const numbers = plate.replace(/[^0-9]/g, '');
    if (numbers.length === 0) {
        return -1;
    }
    return Number(digit === 'firstNumber' ? numbers[0] : numbers[numbers.length - 1]);
};

const withoutAccents = (value: string): string =>
    value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();

const dayKey = (date: Date): string =>
    `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date
        .getDate()
        .toString()
        .padStart(2, '0')}`;

const isHoliday = (date: Date, city: PicoYPlacaCity | null): boolean => {
    const key = dayKey(date);
    return (
        COLOMBIA_HOLIDAYS_2026.includes(key) || (city?.holidays ?? []).includes(key)
    );
};

const cityFor = (text: string): PicoYPlacaCity | null => {
    const haystack = withoutAccents(text);
    if (haystack.length === 0) {
        return null;
    }
    return (
        PICO_Y_PLACA_CITIES.find((city) =>
            city.aliases.some((alias) => haystack.includes(withoutAccents(alias))),
        ) ?? null
    );
};

const restrictedNumbers = (city: PicoYPlacaCity, date: Date): number[] => {
    if (city.blocked) {
        return date.getDate() % 2 === 0 ? city.blocked.even : city.blocked.odd;
    }
    const key = dayKey(date);
    const rotation = city.rotation?.find((item) => key >= item.from && key <= item.to);
    if (!rotation) {
        return [];
    }
    const weekday = date.getDay();
    return weekday >= 1 && weekday <= 5 ? rotation.days[weekday - 1] : [];
};

/**
 * What the pico y placa means for this plate, in this city, right now.
 * The clock is the clock of the phone and the hours are the hours of the city.
 */
export const picoYPlacaState = (
    plate: string,
    placeText: string,
    now: Date,
): PicoYPlacaResult => {
    const clean = normalizePlate(plate);
    if (clean.length === 0) {
        return { kind: 'no-plate', city: null, plate: null };
    }

    const city = cityFor(placeText);
    if (!city) {
        return { kind: 'no-data', city: null, plate: clean };
    }

    if (city.motorcycleExempt) {
        return {
            kind: 'not-today',
            city: city.name,
            plate: clean,
            note: city.motorcycleNote,
        };
    }

    const weekday = now.getDay();
    if (weekday < 1 || weekday > 5 || isHoliday(now, city)) {
        return { kind: 'not-today', city: city.name, plate: clean };
    }

    const number = restrictionNumber(clean, city.digit);
    if (!restrictedNumbers(city, now).includes(number)) {
        return { kind: 'not-today', city: city.name, plate: clean };
    }

    const hour = now.getHours();
    if (hour < city.from) {
        return {
            kind: 'later',
            city: city.name,
            plate: clean,
            from: city.from,
            to: city.to,
        };
    }
    if (hour >= city.to) {
        return { kind: 'not-today', city: city.name, plate: clean, to: city.to };
    }

    return { kind: 'now', city: city.name, plate: clean, from: city.from, to: city.to };
};

export type PicoYPlacaTone = 'restricted' | 'upcoming' | 'clear' | 'unknown';

export interface PicoYPlacaText {
    title: string;
    body: string;
    tone: PicoYPlacaTone;
}

const hourLabel = (value?: number): string =>
    `${(value ?? 0).toString().padStart(2, '0')}:00`;

/** what the sheet says about the restriction */
export const picoYPlacaText = (result: PicoYPlacaResult): PicoYPlacaText => {
    switch (result.kind) {
        case 'no-plate':
            return {
                title: 'Pico y placa',
                body: 'Add the licence plate in Settings to see the restriction.',
                tone: 'unknown',
            };
        case 'no-data':
            return {
                title: 'Pico y placa',
                body: 'No pico y placa published for this city.',
                tone: 'unknown',
            };
        case 'not-today':
            return {
                title: 'Pico y placa',
                body: result.note
                    ? result.note
                    : result.to !== undefined
                        ? `The restriction in ${result.city} ended at ${hourLabel(result.to)}.`
                        : `No restriction for plate ${result.plate} in ${result.city} today.`,
                tone: 'clear',
            };
        case 'later':
            return {
                title: 'Pico y placa',
                body: `Plate ${result.plate} is restricted in ${result.city} from ${hourLabel(
                    result.from,
                )} to ${hourLabel(result.to)}.`,
                tone: 'upcoming',
            };
        case 'now':
            return {
                title: 'Pico y placa',
                body: `Plate ${result.plate} is restricted in ${result.city} until ${hourLabel(
                    result.to,
                )}.`,
                tone: 'restricted',
            };
    }
};
