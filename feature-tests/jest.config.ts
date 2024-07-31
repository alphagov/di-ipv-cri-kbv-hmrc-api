import type { Config } from "jest";
import dotenv from "dotenv";
dotenv.config();

const config: Config = {
  preset: "ts-jest",
  testEnvironment: "node",
  coveragePathIgnorePatterns: ["/node_modules/"],
  testMatch: ["**/**/*.step.ts"],
  verbose: true,
  forceExit: true,
  setupFiles: ["./jest-cucumber-config"],
  //coverageReporters: ["html","text"],
  transform: {
    "^.+\\.tsx?$": "ts-jest",
  },
  globals: {
    "ts-jest": {
      isolatedModules: true,
    },
  },
  reporters: [
    "default",
    ["jest-junit", { outputDirectory: "results", outputName: "report.xml" }],
  ],
  testTimeout: 100_000,
};
export default config;
