const { createDefaultEsmPreset } = require("ts-jest");

const preset = createDefaultEsmPreset();

/** @type {import('jest').Config} */
module.exports = {
  ...preset,
  roots: ["<rootDir>/tests"],
  testEnvironment: "node",
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
  transform: {
    ...preset.transform,
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        useESM: true,
        diagnostics: {
          ignoreCodes: [151002],
        },
      },
    ],
  },
};
