// check this file using TypeScript if available
// @ts-check

import { User, Comment } from "../../../src/models";

const apiComments = `${Cypress.expose("apiUrl")}/comments`;

type TestCommentsCtx = {
  authenticatedUser?: User;
  otherUser?: User;
  transactionId?: string;
};

describe("Comments API", function () {
  let ctx: TestCommentsCtx = {};

  before(() => {
    // Hacky workaround to have the e2e tests pass when cy.visit('http://localhost:3000') is called
    cy.request("GET", "/");
  });

  beforeEach(function () {
    cy.task("db:seed");

    cy.database("filter", "users").then((users: User[]) => {
      ctx.authenticatedUser = users[0];
      ctx.otherUser = users[1];

      return cy.loginByApi(ctx.authenticatedUser.username);
    });

    cy.database("find", "comments").then((comment: Comment) => {
      ctx.transactionId = comment.transactionId;
    });
  });

  context("GET /comments/:transactionId", function () {
    it("gets a list of comments for a transaction", function () {
      const transactionId = ctx.transactionId!;
      cy.request("GET", `${apiComments}/${transactionId}`).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.comments).to.be.an("array").that.has.length(1);
      });
    });
  });

  context("POST /comments/:transactionId", function () {
    it("creates a new comment for a transaction", function () {
      const transactionId = ctx.transactionId!;
      cy.request("POST", `${apiComments}/${transactionId}`, {
        content: "This is my comment",
      }).then((response) => {
        expect(response.status).to.eq(200);
      });
    });
  });

  context("DELETE /comments/:transactionId/:commentId", function () {
    const createCommentBy = (user: User, transactionId: string, content: string) =>
      cy
        .loginByApi(user.username)
        .then(() =>
          cy
            .request("POST", `${apiComments}/${transactionId}`, { content })
            .then(() =>
              cy.database("find", "comments", { transactionId, userId: user.id, content })
            )
        );

    it("deletes a comment the signed-in user wrote", function () {
      const transactionId = ctx.transactionId!;
      const content = "Comment I can delete";

      createCommentBy(ctx.authenticatedUser!, transactionId, content).then((comment: Comment) => {
        cy.request("DELETE", `${apiComments}/${transactionId}/${comment.id}`).then((response) => {
          expect(response.status).to.eq(204);
        });

        cy.database("find", "comments", { id: comment.id }).then((deleted: Comment) => {
          expect(deleted).to.not.exist;
        });
      });
    });

    it("does not delete a comment another user wrote", function () {
      const transactionId = ctx.transactionId!;
      const content = "Comment belonging to someone else";

      createCommentBy(ctx.otherUser!, transactionId, content).then((comment: Comment) => {
        // signed back in as the user who did not write the comment
        cy.loginByApi(ctx.authenticatedUser!.username);

        cy.request("DELETE", `${apiComments}/${transactionId}/${comment.id}`).then((response) => {
          expect(response.status).to.eq(403);
        });

        cy.database("find", "comments", { id: comment.id }).then((stillThere: Comment) => {
          expect(stillThere).to.exist;
        });
      });
    });

    it("responds 404 for a comment that is not there", function () {
      const transactionId = ctx.transactionId!;

      // a syntactically valid shortId that no comment has
      cy.request({
        method: "DELETE",
        url: `${apiComments}/${transactionId}/zzzzzzzzzz`,
        failOnStatusCode: false,
      }).then((response) => {
        expect(response.status).to.eq(404);
      });

      createCommentBy(ctx.authenticatedUser!, transactionId, "Comment to be deleted twice").then(
        (comment: Comment) => {
          cy.request("DELETE", `${apiComments}/${transactionId}/${comment.id}`).then((response) => {
            expect(response.status).to.eq(204);
          });

          cy.request({
            method: "DELETE",
            url: `${apiComments}/${transactionId}/${comment.id}`,
            failOnStatusCode: false,
          }).then((response) => {
            expect(response.status).to.eq(404);
          });
        }
      );
    });
  });
});
