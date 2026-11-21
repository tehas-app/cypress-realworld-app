import { User } from "../../../src/models";
import { isMobile } from "../../support/utils";

describe("User Settings", function () {
  beforeEach(function () {
    cy.task("db:seed");

    cy.intercept("PATCH", "/users/*").as("updateUser");
    cy.intercept("GET", "/notifications*").as("getNotifications");

    cy.database("find", "users").then((user: User) => {
      cy.loginByXstate(user.username);
    });

    if (isMobile()) {
      cy.getBySel("sidenav-toggle").click();
    }

    cy.getBySel("sidenav-user-settings").click();
  });

  it("renders the user settings form", function () {
    cy.wait("@getNotifications");
    cy.getBySel("user-settings-form").should("be.visible");
    cy.location("pathname").should("include", "/user/settings");

    cy.visualSnapshot("User Settings Form");
  });

  it("should display user setting form errors", function () {
    ["first", "last"].forEach((field) => {
      cy.getBySelLike(`${field}Name-input`).type("Abc");
      cy.getBySelLike(`${field}Name-input`).clear();
      cy.getBySelLike(`${field}Name-input`).blur();
      cy.get(`#user-settings-${field}Name-input-helper-text`)
        .should("be.visible")
        .and("contain", `Enter a ${field} name`);
    });

    cy.getBySelLike("email-input").type("abc");
    cy.getBySelLike("email-input").clear();
    cy.getBySelLike("email-input").blur();
    cy.get("#user-settings-email-input-helper-text")
      .should("be.visible")
      .and("contain", "Enter an email address");

    cy.getBySelLike("email-input").type("abc@bob.");
    cy.getBySelLike("email-input").blur();
    cy.get("#user-settings-email-input-helper-text")
      .should("be.visible")
      .and("contain", "Must contain a valid email address");

    cy.getBySelLike("phoneNumber-input").type("abc");
    cy.getBySelLike("phoneNumber-input").clear();
    cy.getBySelLike("phoneNumber-input").blur();
    cy.get("#user-settings-phoneNumber-input-helper-text")
      .should("be.visible")
      .and("contain", "Enter a phone number");

    cy.getBySelLike("phoneNumber-input").type("615-555-");
    cy.getBySelLike("phoneNumber-input").blur();
    cy.get("#user-settings-phoneNumber-input-helper-text")
      .should("be.visible")
      .and("contain", "Phone number is not valid");

    // Nine digits: separators are fine, the digit count is not.
    cy.getBySelLike("phoneNumber-input").clear();
    cy.getBySelLike("phoneNumber-input").type("615-555-121");
    cy.getBySelLike("phoneNumber-input").blur();
    cy.get("#user-settings-phoneNumber-input-helper-text")
      .should("be.visible")
      .and("contain", "Phone number is not valid");

    // Eleven digits is not ten digits either.
    cy.getBySelLike("phoneNumber-input").clear();
    cy.getBySelLike("phoneNumber-input").type("61555512123");
    cy.getBySelLike("phoneNumber-input").blur();
    cy.get("#user-settings-phoneNumber-input-helper-text")
      .should("be.visible")
      .and("contain", "Phone number is not valid");

    cy.getBySelLike("submit").should("be.disabled");
    cy.visualSnapshot("User Settings Form Errors and Submit Disabled");
  });

  it("accepts a phone number of ten digits with separators", function () {
    cy.getBySelLike("email-input").clear();
    cy.getBySelLike("email-input").type("email@email.com");
    cy.getBySelLike("email-input").blur();
    cy.getBySelLike("phoneNumber-input").clear();
    cy.getBySelLike("phoneNumber-input").type("(615) 555-1212");
    cy.getBySelLike("phoneNumber-input").blur();

    cy.get("#user-settings-email-input-helper-text").should("not.be.visible");
    cy.get("#user-settings-phoneNumber-input-helper-text").should("not.be.visible");
    cy.getBySelLike("submit").should("not.be.disabled");
    cy.visualSnapshot("User Settings Form Separated Phone Number Valid");
  });

  it("rejects a phone number that is only spaces", function () {
    cy.getBySelLike("phoneNumber-input").clear();
    cy.getBySelLike("phoneNumber-input").type("   ");
    cy.getBySelLike("phoneNumber-input").blur();
    // .trim() runs before required, so spaces are no number at all — the same message an
    // emptied field gets, not "Phone number is not valid".
    cy.get("#user-settings-phoneNumber-input-helper-text")
      .should("be.visible")
      .and("contain", "Enter a phone number");

    cy.getBySelLike("submit").should("be.disabled");
    cy.visualSnapshot("User Settings Form Whitespace Phone Number Invalid");
  });

  it("updates first name, last name, email and phone number", function () {
    cy.getBySelLike("firstName").clear();
    cy.getBySelLike("firstName").type("New First Name");
    cy.getBySelLike("lastName").clear();
    cy.getBySelLike("lastName").type("New Last Name");
    cy.getBySelLike("email").clear();
    cy.getBySelLike("email").type("email@email.com");
    // The seeded faker phone number can carry an extension, so type ten digits.
    cy.getBySelLike("phoneNumber-input").clear();
    cy.getBySelLike("phoneNumber-input").type("6155551212");
    cy.getBySelLike("phoneNumber-input").blur();

    cy.getBySelLike("submit").should("not.be.disabled");
    cy.getBySelLike("submit").click();

    cy.wait("@updateUser").its("response.statusCode").should("equal", 204);

    if (isMobile()) {
      cy.getBySel("sidenav-toggle").click();
    }

    cy.getBySel("sidenav-user-full-name").should("contain", "New First Name");
    cy.visualSnapshot("User Settings Update Profile");
  });
});
