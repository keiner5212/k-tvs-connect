interface Rgb {
    r: number;
    g: number;
    b: number;
}

const hexToRgb = (hex: string): Rgb => {
    const normalized = hex.replace('#', '');
    const expanded =
        normalized.length === 3
            ? normalized
                .split('')
                .map((char) => char + char)
                .join('')
            : normalized;

    return {
        r: parseInt(expanded.slice(0, 2), 16),
        g: parseInt(expanded.slice(2, 4), 16),
        b: parseInt(expanded.slice(4, 6), 16),
    };
};

export const rgba = (hex: string, alpha: number): string => {
    const { r, g, b } = hexToRgb(hex);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};
