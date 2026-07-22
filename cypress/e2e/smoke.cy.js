describe("Smoke", () => {
  it("carga la home y muestra el listado de videos", () => {
    cy.visit("/");
    cy.contains("h1", "Videos recientes").should("be.visible");
  });

  it("carga la pantalla de login", () => {
    cy.visit("/login");
    cy.contains("h1", "Bienvenido de vuelta").should("be.visible");
    cy.get("#usuario").should("be.visible");
    cy.get("#password").should("be.visible");
  });
});
