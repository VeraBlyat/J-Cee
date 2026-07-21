describe("Smoke", () => {
  it("carga la home y muestra el listado de videos", () => {
    cy.visit("/");
    cy.contains("h1", "Videos recientes").should("be.visible");
  });

  it("carga la pantalla de login", () => {
    cy.visit("/login");
    cy.contains("h1", "Iniciar sesión").should("be.visible");
    cy.get("input[placeholder='Usuario']").should("be.visible");
    cy.get("input[placeholder='Contraseña']").should("be.visible");
  });
});
