module.exports = {
    presets: [["babel-preset-expo", { unstable_transformImportMeta: true }]],
    plugins: [
        "nativewind/babel",
        [
            "module-resolver",
            {
                root: ["./"],
                alias: {
                    "@": "./src",
                    "@ble": "./src/ble",
                    "@components": "./src/components",
                    "@hooks": "./src/hooks",
                    "@screens": "./src/screens",
                    "@navigation": "./src/navigation",
                    "@config": "./src/config",
                    "@stores": "./src/stores",
                    "@locales": "./src/locales",
                    "@utils": "./src/utils",
                    "@services": "./src/services",
                    "@constants": "./src/constants",
                    "@contexts": "./src/contexts",
                    "@typings": "./src/types",
                },
            },
        ],
    ],
};
