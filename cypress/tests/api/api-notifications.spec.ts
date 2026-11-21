import { User, NotificationType, Like, Comment, Transaction } from "../../../src/models";

const apiNotifications = `${Cypress.expose("apiUrl")}/notifications`;

type TestNotificationsCtx = {
  authenticatedUser?: User;
  transactionId?: string;
  notificationId?: string;
  unreadNotificationId?: string;
  likeId?: string;
  commentId?: string;
};

describe("Notifications API", function () {
  let ctx: TestNotificationsCtx = {};

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

    cy.database("find", "transactions").then((transaction: Transaction) => {
      ctx.transactionId = transaction.id;
    });

    cy.database("find", "notifications").then((notification: NotificationType) => {
      ctx.notificationId = notification.id;
    });

    // A second row of the same user that stays unread, to prove ?all=true is
    // not just the read rows. uBmeaz5pX is the first user in the seed, which is
    // also what cy.database("filter", "users")[0] hands out as the signed-in
    // user, and the seed has 8 unread rows for them.
    //
    // The exclusion is done in JS, not in the query: cy.database runs the query
    // through lodash's `matches` (cypress.config.ts), which has no Mongo
    // operators - an `id: { $ne: ... }` would be matched as a literal `id.$ne`
    // property that no row has, and `find` would hand back undefined.
    cy.database("filter", "notifications", { userId: "uBmeaz5pX" }).then(
      (notifications: NotificationType[]) => {
        ctx.unreadNotificationId = notifications.find(
          (notification) => notification.id !== ctx.notificationId
        )!.id;
      }
    );

    cy.database("find", "likes").then((like: Like) => {
      ctx.likeId = like.transactionId;
    });

    cy.database("find", "comments").then((comment: Comment) => {
      ctx.commentId = comment.transactionId;
    });
  });

  context("GET /notifications", function () {
    it("gets a list of notifications for a user", function () {
      cy.request("GET", `${apiNotifications}`).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.results.length).to.be.greaterThan(0);
      });
    });

    it("gets only unread notifications, so ?all=true is the only way to see read ones", function () {
      cy.request("GET", `${apiNotifications}`).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.results.length).to.be.greaterThan(0);
        response.body.results.forEach((notification: NotificationType) => {
          expect(notification.isRead).to.eq(false);
        });
      });
    });

    it("gets read and unread notifications for a user with ?all=true", function () {
      // The seed has no read rows, so one is made read through the API rather
      // than by editing data/database-seed.json. Marking before both requests
      // keeps the plain GET (unread only) comparable.
      cy.request("PATCH", `${apiNotifications}/${ctx.notificationId}`, { isRead: true }).then(
        () => {
          cy.request("GET", `${apiNotifications}?all=true`).then((response) => {
            expect(response.status).to.eq(200);
            expect(response.body.results.length).to.be.greaterThan(0);

            const ids = response.body.results.map(
              (notification: NotificationType) => notification.id
            );
            expect(ids).to.include(ctx.notificationId);
            expect(ids).to.include(ctx.unreadNotificationId);

            const read = response.body.results.filter(
              (notification: NotificationType) => notification.isRead
            );
            const unread = response.body.results.filter(
              (notification: NotificationType) => !notification.isRead
            );
            expect(read.length).to.eq(1);
            expect(unread.length).to.be.greaterThan(0);

            // Newest first, by modifiedAt.
            const modifiedAt = response.body.results.map((notification: NotificationType) =>
              new Date(notification.modifiedAt).getTime()
            );
            expect(modifiedAt).to.deep.equal([...modifiedAt].sort((a, b) => b - a));

            // The signed-in user's rows only.
            response.body.results.forEach((notification: NotificationType) => {
              expect(notification.userId).to.eq(ctx.authenticatedUser!.id);
            });

            // Without `all` the same user still sees unread only, and the row
            // just marked read is gone.
            return cy
              .request("GET", `${apiNotifications}`)
              .then((unreadOnly: Cypress.Response<{ results: NotificationType[] }>) => {
                expect(unreadOnly.body.results.length).to.eq(unread.length);
                unreadOnly.body.results.forEach((notification: NotificationType) => {
                  expect(notification.isRead).to.eq(false);
                });
              });
          });
        }
      );
    });
  });

  context("POST /notifications", function () {
    it("creates notifications for transaction, like and comment", function () {
      cy.request("POST", `${apiNotifications}/bulk`, {
        items: [
          {
            type: "payment",
            transactionId: ctx.transactionId,
            status: "received",
          },
          {
            type: "like",
            transactionId: ctx.transactionId,
            likeId: ctx.likeId,
          },
          {
            type: "comment",
            transactionId: ctx.transactionId,
            commentId: ctx.commentId,
          },
        ],
      }).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.results.length).to.equal(3);
        expect(response.body.results[0].transactionId).to.equal(ctx.transactionId);
      });
    });
  });

  context("PATCH /notifications/:notificationId", function () {
    it("updates a notification", function () {
      cy.request("PATCH", `${apiNotifications}/${ctx.notificationId}`, {
        isRead: true,
      }).then((response) => {
        expect(response.status).to.eq(204);
      });
    });

    it("errors when invalid field sent", function () {
      cy.request({
        method: "PATCH",
        url: `${apiNotifications}/${ctx.notificationId}`,
        failOnStatusCode: false,
        body: {
          notANotificationField: "not a notification field",
        },
      }).then((response) => {
        expect(response.status).to.eq(422);
        expect(response.body.errors.length).to.eq(1);
      });
    });
  });
});
