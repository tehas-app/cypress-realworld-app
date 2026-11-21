import { isMobile } from "../../support/utils";
import { User, Transaction } from "../../../src/models";

type NotificationsCtx = {
  userA: User;
  userB: User;
  userC: User;
};

describe("Notifications", function () {
  const ctx = {} as NotificationsCtx;

  beforeEach(function () {
    cy.task("db:seed");

    cy.intercept("GET", "/notifications*").as("getNotifications");
    cy.intercept("POST", "/transactions").as("createTransaction");
    cy.intercept("PATCH", "/notifications/*").as("updateNotification");
    cy.intercept("POST", "/comments/*").as("postComment");

    cy.database("filter", "users").then((users: User[]) => {
      ctx.userA = users[0];
      ctx.userB = users[1];
      ctx.userC = users[2];
    });
  });

  describe("notifications from user interactions", function () {
    it("User A likes a transaction of User B; User B gets notification that User A liked transaction ", function () {
      cy.loginByXstate(ctx.userA.username);
      cy.wait("@getNotifications");

      cy.database("find", "transactions", { senderId: ctx.userB.id }).then(
        (transaction: Transaction) => {
          cy.visit(`/transaction/${transaction.id}`);
        }
      );

      cy.log("🚩 Renders the notifications badge with count");
      // The badge counts unread only, even though the page now fetches read
      // rows too with ?all=true. User B has no read notification at this point
      // (the seed has none), so the badge still equals the response length.
      cy.wait("@getNotifications")
        .its("response.body.results.length")
        .then((notificationCount) => {
          cy.getBySel("nav-top-notifications-count").should("have.text", `${notificationCount}`);
        });
      cy.visualSnapshot("Renders the notifications badge with count");

      const likesCountSelector = "[data-test*=transaction-like-count]";
      cy.contains(likesCountSelector, 0);
      cy.getBySelLike("like-button").click();
      // a successful "like" should disable the button and increment
      // the number of likes
      cy.getBySelLike("like-button").should("be.disabled");
      cy.contains(likesCountSelector, 1);
      cy.visualSnapshot("Like Count Incremented");

      cy.switchUserByXstate(ctx.userB.username);
      cy.visualSnapshot(`Switch to User ${ctx.userB.username}`);

      cy.wait("@getNotifications");

      cy.visit("/notifications");

      cy.wait("@getNotifications");

      cy.getBySelLike("notification-list-item")
        .should("have.length", 9)
        .first()
        .should("contain", ctx.userA?.firstName)
        .and("contain", "liked");

      cy.log("🚩 Marks notification as read");
      cy.getBySelLike("notification-mark-read").first().click({ force: true });
      cy.wait("@updateNotification");

      // The dismissed row stays in the list, dimmed and without its "Dismiss"
      // control, because the page shows read notifications by default. The
      // `-read` suffix on data-test marks it as such.
      cy.get('[data-test^="notification-list-item-"][data-test$="-read"]')
        .should("have.length", 1)
        .and("not.contain", "Dismiss");
      cy.getBySelLike("notification-list-item").should("have.length", 9);

      cy.getBySelLike("notification-mark-read")
        .should("have.length", 8)
        .and("have.length.lessThan", 9);

      // The badge dropped by one: read rows no longer count towards it.
      cy.getBySel("nav-top-notifications-count").should("have.text", "8");
      cy.visualSnapshot("Notification count after notification dismissed");

      cy.log("🚩 Unread-only toggle hides the read notification");
      cy.getBySel("notifications-unread-only-input").click();
      cy.getBySelLike("notification-list-item")
        .should("have.length", 8)
        .should("not.contain", "Dismiss");
      cy.visualSnapshot("Unread only toggle on");
    });

    it("User C likes a transaction between User A and User B; User A and User B get notifications that User C liked transaction", function () {
      cy.loginByXstate(ctx.userC.username);

      cy.database("find", "transactions", {
        senderId: ctx.userB.id,
        receiverId: ctx.userA.id,
      }).then((transaction: Transaction) => {
        cy.visit(`/transaction/${transaction.id}`);
      });

      const likesCountSelector = "[data-test*=transaction-like-count]";
      cy.contains(likesCountSelector, 0);
      cy.getBySelLike("like-button").click();
      cy.getBySelLike("like-button").should("be.disabled");
      cy.contains(likesCountSelector, 1);
      cy.visualSnapshot("Like Count Incremented");

      cy.switchUserByXstate(ctx.userA.username);
      cy.visualSnapshot(`Switch to User ${ctx.userA.username}`);

      cy.getBySelLike("notifications-link").click();

      cy.wait("@getNotifications");

      cy.location("pathname").should("equal", "/notifications");

      cy.getBySelLike("notification-list-item")
        .should("have.length", 9)
        .first()
        .should("contain", ctx.userC.firstName)
        .and("contain", "liked");
      cy.visualSnapshot("User A Notified of User B Like");

      cy.switchUserByXstate(ctx.userB.username);
      cy.visualSnapshot(`Switch to User ${ctx.userB.username}`);

      cy.getBySelLike("notifications-link").click();

      cy.wait("@getNotifications");

      cy.getBySelLike("notification-list-item")
        .should("have.length", 9)
        .first()
        .should("contain", ctx.userC.firstName)
        .and("contain", "liked");
      cy.visualSnapshot("User B Notified of User C Like");
    });

    it("User A comments on a transaction of User B; User B gets notification that User A commented on their transaction", function () {
      cy.loginByXstate(ctx.userA.username);
      cy.visualSnapshot("Logged in as user A");

      cy.database("find", "transactions", { senderId: ctx.userB.id }).then(
        (transaction: Transaction) => {
          cy.visit(`/transaction/${transaction.id}`);
        }
      );

      cy.getBySelLike("comment-input").type("Thank You{enter}");

      cy.wait("@postComment");

      cy.switchUserByXstate(ctx.userB.username);
      cy.visualSnapshot(`Switch to User ${ctx.userB.username}`);

      cy.getBySelLike("notifications-link").click();

      cy.wait("@getNotifications");

      cy.getBySelLike("notification-list-item")
        .should("have.length", 9)
        .first()
        .should("contain", ctx.userA?.firstName)
        .and("contain", "commented");
      cy.visualSnapshot("User A Notified of User B Comment");
    });

    it("User C comments on a transaction between User A and User B; User A and B get notifications that User C commented on their transaction", function () {
      cy.loginByXstate(ctx.userC.username);

      cy.database("find", "transactions", {
        senderId: ctx.userB.id,
        receiverId: ctx.userA.id,
      }).then((transaction: Transaction) => {
        cy.visit(`/transaction/${transaction.id}`);
      });

      cy.getBySelLike("comment-input").type("Thank You{enter}");

      cy.wait("@postComment");

      cy.switchUserByXstate(ctx.userA.username);
      cy.visualSnapshot("Switch to User A");
      cy.visualSnapshot(`Switch to User ${ctx.userA.username}`);

      cy.getBySelLike("notifications-link").click();

      cy.wait("@getNotifications");

      cy.getBySelLike("notification-list-item")
        .should("have.length", 9)
        .first()
        .should("contain", ctx.userC.firstName)
        .and("contain", "commented");
      cy.visualSnapshot("User A Notified of User C Comment");

      cy.switchUserByXstate(ctx.userB.username);
      cy.visualSnapshot(`Switch to User ${ctx.userB.username}`);

      cy.getBySelLike("notifications-link").click();
      cy.getBySelLike("notification-list-item")
        .should("have.length", 9)
        .first()
        .should("contain", ctx.userC.firstName)
        .and("contain", "commented");
      cy.visualSnapshot("User B Notified of User C Comment");
    });

    it("User A sends a payment to User B", function () {
      cy.loginByXstate(ctx.userA.username);

      cy.getBySelLike("new-transaction").click();
      cy.createTransaction({
        transactionType: "payment",
        amount: 30,
        description: "🍕Pizza",
        sender: ctx.userA,
        receiver: ctx.userB,
      });
      cy.wait("@createTransaction");

      cy.switchUserByXstate(ctx.userB.username);
      cy.visualSnapshot(`Switch to User ${ctx.userB.username}`);

      cy.getBySelLike("notifications-link").click();
      cy.visualSnapshot("Navigate to Notifications");

      cy.getBySelLike("notification-list-item")
        .first()
        .should("contain", ctx.userB.firstName)
        .and("contain", "received payment");
      cy.visualSnapshot("User B Notified of Payment");
    });

    it("User A sends a payment request to User C", function () {
      cy.loginByXstate(ctx.userA.username);

      cy.getBySelLike("new-transaction").click();
      cy.createTransaction({
        transactionType: "request",
        amount: 300,
        description: "🛫🛬 Airfare",
        sender: ctx.userA,
        receiver: ctx.userC,
      });
      cy.wait("@createTransaction");

      cy.switchUserByXstate(ctx.userC.username);
      cy.visualSnapshot(`Switch to User ${ctx.userC.username}`);

      cy.getBySelLike("notifications-link").click();
      cy.getBySelLike("notification-list-item")
        .should("contain", ctx.userA.firstName)
        .and("contain", "requested payment");
      cy.visualSnapshot("User C Notified of Request from User A");
    });
  });

  it("loads the page with ?all=true", function () {
    // The page asks the API for read and unread rows, so a read row exists to be
    // dimmed and for the toggle to hide. The param is added by
    // notificationsMachine's fetchData, so the case pins it on the wire rather
    // than on the FETCH event that carries no param.
    cy.intercept("GET", "/notifications*", { body: { results: [] } }).as("allNotifications");

    cy.loginByXstate(ctx.userA.username);
    cy.getBySel("sidenav-notifications").click();
    cy.location("pathname").should("equal", "/notifications");
    cy.wait("@allNotifications").its("request.url").should("include", "all=true");
  });

  it("renders an empty notifications state", function () {
    cy.intercept("GET", "/notifications*", []).as("notifications");

    cy.loginByXstate(ctx.userA.username);

    if (isMobile()) {
      cy.getBySel("sidenav-toggle").click();
    }
    cy.getBySel("sidenav-notifications").click();
    cy.location("pathname").should("equal", "/notifications");
    cy.getBySel("notification-list").should("not.exist");
    cy.getBySel("empty-list-header").should("contain", "No Notifications");
    cy.visualSnapshot("No Notifications");
  });

  it("renders the unread-only toggle off by default", function () {
    cy.intercept("GET", "/notifications*", []).as("notifications");

    cy.loginByXstate(ctx.userA.username);

    if (isMobile()) {
      cy.getBySel("sidenav-toggle").click();
    }
    cy.getBySel("sidenav-notifications").click();
    cy.location("pathname").should("equal", "/notifications");
    // Both handles of the toggle: `notifications-unread-only` on the label root
    // carries the checked state, `…-input` is the visible control the user
    // clicks (the Switch's own input is visually hidden).
    cy.getBySel("notifications-unread-only").should("exist").find("input").should("not.be.checked");
    cy.getBySel("notifications-unread-only-input").should("exist").and("not.be.checked");
    cy.visualSnapshot("Unread only toggle off by default");
  });

  it('says "No unread notifications" when the toggle hides the read ones', function () {
    // Read rows only, served by the intercept (the seed has none, and the seed
    // must not be edited to make them). Left alone they show dimmed with no
    // "Dismiss"; with the toggle on they disappear and empty the list, which
    // is the state EmptyList must name.
    const readNotification = {
      id: "read-only-row",
      uuid: "0e2b1a1c-0000-4000-8000-000000000001",
      userId: ctx.userA.id,
      transactionId: "read-only-transaction",
      isRead: true,
      userFullName: "Ted Parisian",
      status: "received",
      createdAt: "2024-03-07T19:37:59.120Z",
      modifiedAt: "2024-03-07T19:37:59.120Z",
    };
    cy.intercept("GET", "/notifications*", { body: { results: [readNotification] } }).as(
      "readNotifications"
    );

    cy.loginByXstate(ctx.userA.username);
    cy.wait("@readNotifications");

    if (isMobile()) {
      cy.getBySel("sidenav-toggle").click();
    }
    cy.getBySel("sidenav-notifications").click();
    cy.location("pathname").should("equal", "/notifications");

    // A read row is shown, and carries no Dismiss control. Its data-test gains
    // the "-read" suffix. The badge ignores it: it counts unread only.
    cy.getBySelLike("notification-list-item")
      .should("have.length", 1)
      .and("not.contain", "Dismiss");
    cy.getBySel("nav-top-notifications-count").should("have.text", "0");
    cy.visualSnapshot("Read notification shown, badge counts unread only");

    cy.getBySel("notifications-unread-only-input").click();
    cy.getBySel("notification-list").should("not.exist");
    cy.getBySel("empty-list-header").should("contain", "No unread notifications");
    cy.visualSnapshot("No unread notifications");
  });
});
