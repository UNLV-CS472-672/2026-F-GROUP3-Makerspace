import { faker } from "@faker-js/faker";

// Demo students come from prisma/seed.ts, which CI runs via
// `prisma migrate reset --force` before starting the server.
const DEMO_STUDENT = {
  name: "Maria Sanchez",
  nsheId: "2001234567",
  rebelCardId: "1001234567",
  certification: "Laser Cutter Safety & Operation",
  machine: "Epilog Fusion Pro 48",
};

describe("smoke tests", () => {
  describe("RebelCard check-in", () => {
    it("renders the scan page", () => {
      cy.visitAndCheck("/");

      cy.findByRole("heading", { name: /rebelcard check-in/i });
      cy.findByRole("textbox", { name: /card \/ nshe number/i });
      cy.findByRole("button", { name: /check in/i }).should("be.disabled");
    });

    it("rejects an unknown card", () => {
      cy.visitAndCheck("/");

      cy.findByRole("textbox", { name: /card \/ nshe number/i }).type(
        "0000000000",
      );
      cy.findByRole("button", { name: /check in/i }).click();

      cy.findByText(/rebelcard not recognized/i);
      cy.location("pathname").should("eq", "/");
    });

    it("shows results for a known card", () => {
      cy.visitAndCheck("/");

      cy.findByRole("textbox", { name: /card \/ nshe number/i }).type(
        DEMO_STUDENT.rebelCardId,
      );
      cy.findByRole("button", { name: /check in/i }).click();

      cy.location("pathname").should("eq", `/results/${DEMO_STUDENT.nsheId}`);
      cy.findByText(new RegExp(DEMO_STUDENT.name));
      cy.findByText(new RegExp(DEMO_STUDENT.certification));
      cy.findByText(DEMO_STUDENT.machine);
    });
  });

  describe("admin accounts", () => {
    afterEach(() => {
      cy.cleanupUser();
    });

    it("should allow you to register", () => {
      const loginForm = {
        email: `${faker.internet.userName()}@example.com`,
        password: faker.internet.password(),
      };
      cy.then(() => ({ email: loginForm.email })).as("user");

      cy.visitAndCheck("/join");

      cy.findByRole("textbox", { name: /email/i }).type(loginForm.email);
      cy.findByLabelText(/password/i).type(loginForm.password);
      cy.findByRole("button", { name: /create account/i }).click();

      cy.location("pathname").should("eq", "/");
      cy.findByRole("heading", { name: /rebelcard check-in/i });
    });

    it("should redirect a logged-in user away from /login", () => {
      cy.login();

      cy.visit("/login");

      cy.location("pathname").should("eq", "/");
      cy.findByRole("heading", { name: /rebelcard check-in/i });
    });
  });
});
