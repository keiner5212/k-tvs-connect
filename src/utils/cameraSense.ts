/**
 * The road safety agency writes the sense of a camera inside the free text of
 * its address: "Sentido Sur - Norte", "sentido NORTE-SUR", "(N-S)", "este
 * equipo funciona en sentidos NORTE - SUR".
 *
 * The pair is written in the direction of the traffic the equipment watches: the
 * traffic comes from the first place and goes to the second one. The warning
 * signs of the camera are placed on that first side, which is what confirms the
 * reading of the pairs.
 *
 * The camera is aimed towards the second place, the way the traffic goes, so it
 * photographs that traffic from behind as it leaves. A rider that goes the same
 * way leaves the camera behind and it reads the plate. A rider that goes the
 * other way faces the camera and shows it the front of the bike.
 */

const COMPASS_WORDS: Record<string, number> = {
    N: 0,
    S: 180,
    E: 90,
    O: 270,
    NE: 45,
    NO: 315,
    SE: 135,
    SO: 225,
    NNE: 22.5,
    NNO: 337.5,
    ENE: 67.5,
    ENO: 292.5,
    ESE: 112.5,
    OSO: 247.5,
    SSE: 157.5,
    SSO: 202.5,
};

const SPANISH_WORDS: Record<string, string> = {
    NORTE: 'N',
    SUR: 'S',
    ESTE: 'E',
    ORIENTE: 'E',
    OESTE: 'O',
    OCCIDENTE: 'O',
    NORESTE: 'NE',
    NORDESTE: 'NE',
    NOROESTE: 'NO',
    NORDOESTE: 'NO',
    SURESTE: 'SE',
    SURDESTE: 'SE',
    SUROESTE: 'SO',
    SUDOESTE: 'SO',
    NORNORESTE: 'NNE',
    NORNOROESTE: 'NNO',
    ESTENORESTE: 'ENE',
    ESTENOROESTE: 'ENO',
    ESTESURESTE: 'ESE',
    ESTESUDOESTE: 'ESO',
    OESTENORESTE: 'ENE',
    OESTENOROESTE: 'ENO',
    OESTESURESTE: 'ESE',
    OESTESUDOESTE: 'ESO',
    SURSURESTE: 'SSE',
    SURSUROESTE: 'SSO',
    OCC: 'O',
    ORI: 'E',
};

const THREE_LETTERS = ['NNE', 'NNO', 'ENE', 'ENO', 'ESE', 'ESO', 'SSE', 'SSO'];

export interface CameraSense {
    /** the direction the camera looks, the risky one for the rider */
    riskyBearing: number | null;
    /** the bearing of the road, the axis of the camera */
    axisBearing: number | null;
    /** true when the equipment watches both senses of the axis */
    bothWays: boolean;
}

const cleanText = (value: string): string =>
    value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase();

/** The compass points of a phrase, in the order they are written. */
const compassTokens = (text: string): string[] => {
    const tokens: string[] = [];
    const words = text.split(/[^A-Z]+/).filter((word) => word.length > 0);

    for (const word of words) {
        const spanish = SPANISH_WORDS[word];
        if (spanish) {
            tokens.push(spanish);
            continue;
        }

        let rest = word;
        while (rest.length > 0) {
            const three = rest.slice(0, 3);
            if (THREE_LETTERS.includes(three)) {
                tokens.push(three);
                rest = rest.slice(3);
                continue;
            }
            const two = rest.slice(0, 2);
            if (COMPASS_WORDS[two] !== undefined) {
                tokens.push(two);
                rest = rest.slice(2);
                continue;
            }
            const one = rest.slice(0, 1);
            if (COMPASS_WORDS[one] !== undefined) {
                tokens.push(one);
                rest = rest.slice(1);
                continue;
            }
            rest = rest.slice(1);
        }
    }

    return tokens;
};

const bearingOf = (token: string): number | null => {
    const value = COMPASS_WORDS[token];
    return value === undefined ? null : value;
};

/**
 * Reads the sense of a camera from its address. It returns null when the
 * agency did not publish one, and then the app has to assume the worst.
 */
export const parseCameraSense = (address: string): CameraSense | null => {
    if (!address) {
        return null;
    }

    const text = cleanText(address);
    const bothWays = /AMBOS SENTIDOS/.test(text);

    let phrase = '';
    const sentido = /SENTIDO[S]?\s*(.{0,60})/.exec(text);
    if (sentido) {
        phrase = sentido[1];
    } else {
        const parenthesis = /\(([^)]{0,60})\)/.exec(text);
        if (parenthesis) {
            phrase = parenthesis[1];
        }
    }

    if (bothWays && phrase.trim().length === 0) {
        phrase = text;
    }

    let tokens = compassTokens(phrase);
    if (tokens.length === 0 && bothWays) {
        tokens = compassTokens(text);
    }
    const bearings = tokens
        .map(bearingOf)
        .filter((value): value is number => value !== null);

    if (bearings.length === 0) {
        return null;
    }

    if (bothWays) {
        return {
            riskyBearing: null,
            axisBearing: bearings[0],
            bothWays: true,
        };
    }

    if (bearings.length >= 2) {
        return {
            riskyBearing: bearings[1],
            axisBearing: bearings[0],
            bothWays: false,
        };
    }

    return {
        riskyBearing: null,
        axisBearing: bearings[0],
        bothWays: false,
    };
};

/** The angle between two bearings, in degrees. */
export const angleBetween = (a: number, b: number): number =>
    Math.abs(((a - b + 540) % 360) - 180);

/**
 * The name of a bearing, the way the agency writes it in the address.
 */
export const compassName = (bearing: number): string => {
    const names = [
        'North',
        'North-northeast',
        'Northeast',
        'East-northeast',
        'East',
        'East-southeast',
        'Southeast',
        'South-southeast',
        'South',
        'South-southwest',
        'Southwest',
        'West-southwest',
        'West',
        'West-northwest',
        'Northwest',
        'North-northwest',
    ];
    const index = Math.round(((bearing % 360) + 360) % 360 / 22.5) % 16;
    return names[index];
};

/**
 * Same direction as the camera looks. Wide enough for a coarse compass label
 * (northeast versus east is 45 degrees) and still short of a side-on crossing,
 * which is 90. The rider is at risk only when the camera is behind the bike.
 */
const SAME_DIRECTION_DEGREES = 60;

/**
 * True when this heading leaves the camera behind the rider, so it sees the
 * plate. Heading toward the camera, and crossing it, are not that case.
 * A camera with no published sense is treated as risky from every heading.
 */
export const isRiskyDirection = (sense: CameraSense | null, travelBearing: number): boolean => {
    if (!sense) {
        return true;
    }
    if (sense.bothWays) {
        if (sense.axisBearing === null) {
            return true;
        }
        const opposite = (sense.axisBearing + 180) % 360;
        return (
            angleBetween(sense.axisBearing, travelBearing) < SAME_DIRECTION_DEGREES ||
            angleBetween(opposite, travelBearing) < SAME_DIRECTION_DEGREES
        );
    }
    if (sense.riskyBearing === null) {
        return true;
    }
    return angleBetween(sense.riskyBearing, travelBearing) < SAME_DIRECTION_DEGREES;
};
