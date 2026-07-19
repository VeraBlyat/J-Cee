import nextConfig from "eslint-config-next";

const eslintConfig = [
  // backend/ es un proyecto Nest.js aparte, con su propio lint/tsconfig.
  { ignores: ["backend/**"] },
  ...nextConfig,
];

export default eslintConfig;
