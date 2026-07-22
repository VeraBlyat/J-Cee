// No importamos "cypress" aquí: el paquete no está en las dependencias del
// proyecto (Cypress se descarga y corre como binario aparte vía npx), así
// que este archivo solo puede exportar un objeto plano.
module.exports = {
  e2e: {
    baseUrl: "http://localhost:3000",
    supportFile: "cypress/support/e2e.js",
  },
};
