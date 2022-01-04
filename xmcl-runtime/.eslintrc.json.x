{
    "extends": [
        "../.eslintrc.json"
    ],
    "overrides": [
        {
            "files": [
                "**/*.ts"
            ],
            "parserOptions": {
                "parser": "@typescript-eslint/parser",
                "ecmaVersion": 2020,
                "sourceType": "module",
                "project": [
                    "tsconfig.json"
                ]
            }
        }
    ]
}