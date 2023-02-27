module.exports = {
  plugins: [require("@trivago/prettier-plugin-sort-imports")],
  importOrderSeparation: true,
  importOrderSortSpecifiers: true,
  importOrder: ["^../typechain", "^[./]"],
  overrides: [
    {
      files: "*.sol",
      options: {
        printWidth: 80,
        useTabs: false,
        singleQuote: false,
        bracketSpacing: true,
      },
    },
    {
      files: "*.json",
      options: {
        printWidth: 0, // trick to have one item per line
      },
    },
  ],
};
