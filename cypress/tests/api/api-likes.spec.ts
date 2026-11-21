// check this file using TypeScript if available
// @ts-check

import { User, Like, Transaction } from "../../../src/models";

const apiLikes = `${Cypress.expose("apiUrl")}/likes`;

type TestLikesCtx = {
  authenticatedUser?: User;
  transactionId?: string;
  unlikedTransactionId?: string;
};

describe("Likes API", function () {
  let ctx: TestLikesCtx = {};

  before(() => {
    // Hacky workaround to have the e2e tests pass when cy.visit('http://localhost:3000') is called
    cy.request("GET", "/");
  });

  beforeEach(function () {
    cy.task("db:seed");

    cy.database("filter", "users").then((users: User[]) => {
      ctx.authenticatedUser = users[0];

      return cy.loginByApi(ctx.authenticatedUser.username);
    });

    cy.database("find", "likes").then((like: Like) => {
      ctx.transactionId = like.transactionId;
    });

    // the seed likes belong to users[0], so pick a transaction of another user
    // that users[0] has not liked yet
    cy.database("filter", "likes").then((likes: Like[]) => {
      const likedTransactionIds = likes.map((like) => like.transactionId);

      cy.database("filter", "transactions").then((transactions: Transaction[]) => {
        const unlikedTransaction = transactions.find(
          (transaction) =>
            transaction.senderId !== ctx.authenticatedUser!.id &&
            transaction.receiverId !== ctx.authenticatedUser!.id &&
            !likedTransactionIds.includes(transaction.id)
        );

        ctx.unlikedTransactionId = unlikedTransaction!.id;
      });
    });
  });

  context("GET /likes/:transactionId", function () {
    it("gets a list of likes for a transaction", function () {
      cy.request("GET", `${apiLikes}/${ctx.transactionId}`).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.likes.length).to.eq(1);
      });
    });
  });

  context("POST /likes/:transactionId", function () {
    it("creates a new like for a transaction", function () {
      cy.request("POST", `${apiLikes}/${ctx.unlikedTransactionId}`, {
        transactionId: ctx.unlikedTransactionId,
      }).then((response) => {
        expect(response.status).to.eq(200);
      });

      cy.request("GET", `${apiLikes}/${ctx.unlikedTransactionId}`).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.likes.length).to.eq(1);
        expect(response.body.likes[0].userId).to.eq(ctx.authenticatedUser!.id);
      });
    });

    it("does not like a transaction twice", function () {
      cy.request("POST", `${apiLikes}/${ctx.transactionId}`, {
        transactionId: ctx.transactionId,
      }).then((response) => {
        expect(response.status).to.eq(200);
      });

      cy.request("POST", `${apiLikes}/${ctx.transactionId}`, {
        transactionId: ctx.transactionId,
      }).then((response) => {
        expect(response.status).to.eq(200);
      });

      cy.request("GET", `${apiLikes}/${ctx.transactionId}`).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.likes.length).to.eq(1);
        expect(response.body.likes[0].userId).to.eq(ctx.authenticatedUser!.id);
      });
    });
  });
});
