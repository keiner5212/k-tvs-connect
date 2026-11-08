/**
 * The catalog of bikes, the same way the original app asks for the model: the
 * family first and then the model of that family. These are the commercial
 * names, the ones on the paperwork of the bike.
 */
export type BikeFamily = 'Apache' | 'Ntorq' | 'Jupiter' | 'IQUBE' | 'Other';

export interface CatalogModel {
    value: string;
    label: string;
    family: BikeFamily;
}

export const BIKE_CATALOG: CatalogModel[] = [
    { value: 'apache-rtr-160-4v-xc-fi', label: 'Apache RTR 160 4V XC FI', family: 'Apache' },
    { value: 'apache-rtr-160-4v-fi', label: 'Apache RTR 160 4V FI', family: 'Apache' },
    { value: 'apache-rtr-160-4v-xc', label: 'Apache RTR 160 4V XC', family: 'Apache' },
    { value: 'apache-rtr-160-4v', label: 'Apache RTR 160 4V', family: 'Apache' },
    { value: 'apache-rtr-160-2v', label: 'Apache RTR 160 2V', family: 'Apache' },
    { value: 'apache-ntr-160-4v', label: 'Apache NTR 160 4V', family: 'Apache' },
    { value: 'apache-rtr-180-4v', label: 'Apache RTR 180 4V', family: 'Apache' },

    { value: 'ntorq-125', label: 'Ntorq 125', family: 'Ntorq' },
    { value: 'ntorq-135', label: 'Ntorq 135', family: 'Ntorq' },
    { value: 'ntorq-160', label: 'Ntorq 160', family: 'Ntorq' },
    { value: 'ntorq-160-race', label: 'Ntorq 160 Race', family: 'Ntorq' },

    { value: 'jupiter-tvs-125', label: 'Jupiter TVS 125', family: 'Jupiter' },
    { value: 'jupiter-tvs-160', label: 'Jupiter TVS 160', family: 'Jupiter' },
    { value: 'jupiter-pro', label: 'Jupiter Pro', family: 'Jupiter' },

    { value: 'iqube-u347', label: 'IQUBE 125', family: 'IQUBE' },
    { value: 'iqube-u467', label: 'IQUBE 150', family: 'IQUBE' },

    { value: 'other', label: 'Another model', family: 'Other' },
];

export const catalogFamily = (value: string): BikeFamily => {
    const found = BIKE_CATALOG.find((entry) => entry.value === value);
    return found?.family ?? 'Other';
};

export const catalogLabel = (value: string): string => {
    const found = BIKE_CATALOG.find((entry) => entry.value === value);
    return found?.label ?? value;
};
