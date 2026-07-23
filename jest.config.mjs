import nextJest from "next/jest.js";

const createJestConfig = nextJest({ dir: "./" });

const customJestConfig = {
  testEnvironment: "jest-environment-jsdom",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
  // backend/ es un proyecto Nest.js aparte con su propia config de Jest.
  testPathIgnorePatterns: ["<rootDir>/node_modules/", "<rootDir>/backend/"],
  // .next/ es salida de build (incluye una copia standalone del repo) y provoca
  // colisiones de módulos en el haste map de Jest; la ignoramos por completo.
  modulePathIgnorePatterns: ["<rootDir>/.next/"],
};

export default createJestConfig(customJestConfig);
