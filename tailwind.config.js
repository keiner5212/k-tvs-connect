/** @type {import('tailwindcss').Config} */
module.exports = {
    content: ["./App.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
    theme: {
        extend: {
            spacing: {
                "0.5": "2px",
                "1": "4px",
                "1.5": "6px",
                "2": "8px",
                "2.5": "10px",
                "3": "12px",
                "4": "16px",
                "5": "20px",
                "6": "24px",
                "7": "28px",
                "8": "32px",
                "9": "36px",
                "10": "40px",
                "12": "48px",
                "14": "56px",
                "16": "64px",
                "18": "72px",
                "20": "80px",
                "24": "96px",
            },
            borderRadius: {
                sm: "6px",
                md: "8px",
                lg: "12px",
                xl: "16px",
                "2xl": "20px",
                "3xl": "24px",
            },
        },
    },
    plugins: [],
};
