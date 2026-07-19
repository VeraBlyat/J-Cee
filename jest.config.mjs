import nextJest from "next/jest.js";

const createJestConfig = nextJest({ dir: "./" });

const customJestConfig = {
  testEnvironment: "jest-environment-jsdom",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
  // backend/ es un proyecto Nest.js aparte con su propia config de Jest.
  testPathIgnorePatterns: ["<rootDir>/node_modules/", "<rootDir>/backend/"],
};

export default createJestConfig(customJestConfig);
