/**
 * The pico y placa tables of the main cities.
 *
 * No city publishes a machine readable endpoint for the restriction, so the
 * rules travel with the app and the official pages are the reference to check
 * them against.
 *
 * Medellin, Decreto 1720184708 de 2026 and the press notes of the Secretaria
 * de Movilidad. The cars read the last digit of the plate, the motorcycles the
 * first number. The measure runs from 05:00 to 20:00, monday to friday, and
 * the rotation changes twice a year.
 * https://www.medellin.gov.co/es/sala-de-prensa/noticias/la-nueva-rotacion-del-pico-y-placa-en-medellin-comenzara-a-regir-a-partir-del-lunes-3-de-agosto/
 * https://www.medellin.gov.co/es/sala-de-prensa/noticias/en-medellin-no-habra-pico-y-placa-durante-semana-santa/
 *
 * Cali, Secretaria de Movilidad Distrital. The last digit of the plate, from
 * 06:00 to 19:00, monday to friday, and the exception list of the decree
 * 4112.010.20.497 includes the motorcycles.
 * https://www.cali.gov.co/boletines/publicaciones/193096/pico-y-placa-rota-en-cali-para-el-segundo-semestre-de-2026-nueva-medida-rige-desde-el-1-de-julio/
 * https://www.enruta.gov.co/publicaciones/130764/pico-y-placa-en-cali-para-el-segundo-semestre-de-2026-asi-funcionara-la-nueva-rotacion/
 *
 * Bogota, Decreto 652 de 2025 and the preguntas frecuentes of la Secretaria
 * Distrital de Movilidad. The parity of the day decides and the last digit of
 * the plate is read, from 06:00 to 21:00, on business days only.
 * https://www.movilidadbogota.gov.co/preguntas-frecuentes/en-que-consiste-la-restriccion-establecida-para-vehiculos-particulares
 *
 * Santa Marta, Decreto 453 del 29 de octubre de 2025 for the motorcycles and
 * Decreto 213 del 8 de mayo de 2026 for the cars, extended by the Decreto 542
 * del 5 de noviembre de 2026. The last digit of the plate in both cases, and
 * the motorcycles are not exempt. The rotation does not change in the middle
 * of the year, it lasts as long as the decree.
 * https://www.santamarta.gov.co/documentos/decreto-no-453-del-29-octubre-2025
 * https://www.santamarta.gov.co/documentos/decretos-no-213-del-08-de-mayo-de-2026
 * The term of the motorcycle decree was one year and it expired on the 5th of
 * November of 2026 with no extension published, so the rule stays because it is
 * the one the city and the press still apply. It has to be checked against a
 * new decree before it is trusted again.
 */

export interface PicoYPlacaRotation {
    /** the first day this rotation applies, as YYYY-MM-DD */
    from: string;
    /** the last day this rotation applies, as YYYY-MM-DD */
    to: string;
    /** the numbers restricted on each weekday, monday first */
    days: number[][];
}

export interface PicoYPlacaCity {
    id: string;
    name: string;
    /** the words that name the city in a place name or an address */
    aliases: string[];
    /** the first hour of the restriction */
    from: number;
    /** the hour the restriction ends */
    to: number;
    /** the first or the last number of the plate decides */
    digit: 'firstNumber' | 'lastNumber';
    /** the numbers restricted per weekday, when the city rotates them */
    rotation?: PicoYPlacaRotation[];
    /** the digits blocked on the odd days of the month and on the even ones */
    blocked?: { odd: number[]; even: number[] };
    /** the motorcycles do not have a restriction */
    motorcycleExempt: boolean;
    /** what the rider has to know about the motorcycles there */
    motorcycleNote?: string;
    /** the days of this city without the measure, on top of the national ones */
    holidays?: string[];
}

export const PICO_Y_PLACA_CITIES: PicoYPlacaCity[] = [
    {
        id: 'medellin',
        name: 'Medellin',
        aliases: ['medellin'],
        from: 5,
        to: 20,
        digit: 'firstNumber',
        rotation: [
            {
                from: '2026-01-01',
                to: '2026-08-02',
                days: [
                    [1, 7],
                    [0, 3],
                    [4, 6],
                    [5, 9],
                    [2, 8],
                ],
            },
            {
                from: '2026-08-03',
                to: '2026-12-31',
                days: [
                    [5, 8],
                    [1, 4],
                    [0, 2],
                    [3, 6],
                    [7, 9],
                ],
            },
        ],
        motorcycleExempt: false,
    },
    {
        id: 'cali',
        name: 'Cali',
        aliases: ['cali'],
        from: 6,
        to: 19,
        digit: 'lastNumber',
        rotation: [
            {
                from: '2026-01-05',
                to: '2026-06-30',
                days: [
                    [1, 2],
                    [3, 4],
                    [5, 6],
                    [7, 8],
                    [9, 0],
                ],
            },
            {
                from: '2026-07-01',
                to: '2026-12-31',
                days: [
                    [9, 0],
                    [1, 2],
                    [3, 4],
                    [5, 6],
                    [7, 8],
                ],
            },
        ],
        motorcycleExempt: true,
        motorcycleNote: 'The motorcycles are exempt in Cali.',
    },
    {
        id: 'bogota',
        name: 'Bogota',
        aliases: ['bogota'],
        from: 6,
        to: 21,
        digit: 'lastNumber',
        blocked: {
            odd: [6, 7, 8, 9, 0],
            even: [1, 2, 3, 4, 5],
        },
        motorcycleExempt: false,
    },
    {
        id: 'santamarta',
        name: 'Santa Marta',
        aliases: ['santa marta'],
        from: 7,
        to: 19,
        digit: 'lastNumber',
        rotation: [
            {
                from: '2025-10-29',
                to: '2026-12-31',
                days: [
                    [1, 2],
                    [3, 4],
                    [5, 6],
                    [7, 8],
                    [9, 0],
                ],
            },
        ],
        motorcycleExempt: false,
        holidays: [
            '2026-07-23',
            '2026-07-24',
            '2026-07-27',
            '2026-07-28',
            '2026-07-29',
        ],
    },
];

/**
 * The national holidays of 2026, when the measure does not run.
 * Ministerio de Hacienda, dias habiles.
 * https://sedeelectronica.minhacienda.gov.co/SedeElectronica/info/inicio.do?formAction=btDiasInhabiles&target=print
 * The local holidays of each city are not in this list, they are the ones a
 * city moves on its own.
 */
export const COLOMBIA_HOLIDAYS_2026 = [
    '2026-01-01',
    '2026-01-12',
    '2026-03-23',
    '2026-04-02',
    '2026-04-03',
    '2026-05-01',
    '2026-05-18',
    '2026-06-08',
    '2026-06-15',
    '2026-06-29',
    '2026-07-13',
    '2026-07-20',
    '2026-08-07',
    '2026-08-17',
    '2026-10-12',
    '2026-11-02',
    '2026-11-16',
    '2026-12-08',
    '2026-12-25',
];
