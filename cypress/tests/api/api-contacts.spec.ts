import { User, Contact } from "../../../src/models";

const apiContacts = `${Cypress.expose("apiUrl")}/contacts`;

type TestContactsCtx = {
  allUsers?: User[];
  authenticatedUser?: User;
  contact?: Contact;
};
describe("Contacts API", function () {
  let ctx: TestContactsCtx = {};

  before(() => {
    // Hacky workaround to have the e2e tests pass when cy.visit('http://localhost:3000') is called
    cy.request("GET", "/");
  });

  beforeEach(function () {
    cy.task("db:seed");

    cy.database("filter", "users").then((users: User[]) => {
      ctx.authenticatedUser = users[0];
      ctx.allUsers = users;

      return cy.loginByApi(ctx.authenticatedUser.username);
    });

    cy.database("find", "contacts").then((contact: Contact) => {
      ctx.contact = contact;
    });
  });

  context("GET /contacts/:username", function () {
    it("gets a list of contacts by username", function () {
      const { username } = ctx.authenticatedUser!;
      cy.request("GET", `${apiContacts}/${username}`).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.contacts[0]).to.have.property("userId");
      });
    });
  });

  context("POST /contacts", function () {
    it("creates a new contact", function () {
      const { id: userId } = ctx.authenticatedUser!;

      cy.request("POST", `${apiContacts}`, {
        contactUserId: ctx.contact!.id,
      }).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.contact.id).to.be.a("string");
        expect(response.body.contact.userId).to.eq(userId);
      });
    });

    it("errors when invalid contactUserId", function () {
      cy.request({
        method: "POST",
        url: `${apiContacts}`,
        failOnStatusCode: false,
        body: {
          contactUserId: "1234",
        },
      }).then((response) => {
        expect(response.status).to.eq(422);
        expect(response.body.errors).to.be.an("array").that.has.length(1);
      });
    });
  });
  context("DELETE /contacts/:contactId", function () {
    it("deletes a contact", function () {
      const { username } = ctx.authenticatedUser!;
      const contactId = ctx.contact!.id;

      cy.request("DELETE", `${apiContacts}/${contactId}`).then((response) => {
        expect(response.status).to.eq(200);

        return cy.request("GET", `${apiContacts}/${username}`).then(({ body }) => {
          expect(body.contacts.some((contact: Contact) => contact.id === contactId)).to.eq(false);
        });
      });
    });

    it("does not let another user delete someone else's contact", function () {
      const otherUser = ctx.allUsers!.find((user: User) => user.id !== ctx.authenticatedUser!.id)!;

      cy.loginByApi(otherUser.username).then(() =>
        cy
          .request({
            method: "DELETE",
            url: `${apiContacts}/${ctx.contact!.id}`,
            failOnStatusCode: false,
          })
          .then((response) => {
            expect(response.status).to.eq(403);
          })
      );
    });

    it("errors when the contact does not exist", function () {
      // a well-formed short id that no seeded contact carries
      cy.request({
        method: "DELETE",
        url: `${apiContacts}/zzzzzzzzzzzzzzz`,
        failOnStatusCode: false,
      }).then((response) => {
        expect(response.status).to.eq(404);
      });
    });
  });
});
