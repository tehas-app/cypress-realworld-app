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

      cy.wait("@getNotifications")
        .its("response.body.results.length")
        .as("preDismissedNotificationCount");

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

      cy.get("@preDismissedNotificationCount").then((count) => {
        cy.getBySelLike("notification-list-item").should("have.length.lessThan", Number(count));
      });
      cy.visualSnapshot("Notification count after notification dismissed");
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

  describe("the Unread only toggle", function () {
    const toggleSelector = "notifications-unread-only";
    const switchSelector = "notifications-unread-only-switch";
    // MUI's Switch spreads its props onto the SwitchBase <span>, so checkedness
    // has to be asserted on the real checkbox rendered inside it.
    const inputSelector = "notifications-unread-only-input";
    const sidenavHomeSelector = "sidenav-home";
    const sidenavNotificationsSelector = "sidenav-notifications";

    // Every row the seed holds is unread and a Dismiss PATCHes then refetches,
    // so with the real API the filter can only ever drop rows the server already
    // dropped. Stubbing the GET is what makes the filter observable: the page
    // keeps serving rows the server has marked read, which is exactly the input
    // the client-side filter exists for. Leaving the route and coming back
    // remounts NotificationsContainer, and its FETCH is the GET that gets stubbed
    // here; intercepting earlier would only replace the rows the previous case
    // already loaded. The rows are like-notifications, which render as
    // "<name> liked a transaction.", so the name picks out a row by content.
    const stubbedResults = (ids: string[]) =>
      ids.map((id, index) => ({
        id,
        uuid: `00000000-0000-4000-8000-00000000000${index}`,
        userId: ctx.userA.id,
        transactionId: `transaction-${id}`,
        likeId: `like-${id}`,
        isRead: false,
        createdAt: new Date().toISOString(),
        modifiedAt: new Date().toISOString(),
        userFullName: `${ctx.userB.firstName} ${ctx.userB.lastName}`,
      }));

    // The toggle only renders on /notifications and the notifications service
    // lives in App, so switching away and back is what remounts
    // NotificationsContainer; its mount effect is the FETCH that picks up the
    // stub. Re-clicking the notifications item would not: the component never
    // unmounts, so no effect re-runs and no FETCH is sent.
    const refetchStubbedNotifications = () => {
      cy.getBySel(sidenavHomeSelector).click();
      cy.location("pathname").should("equal", "/");
      // clicking a drawer item closes the drawer on xs, so it has to be reopened
      // before the notifications leg is clickable
      if (isMobile()) {
        cy.getBySel("sidenav-toggle").click();
      }
      cy.getBySel(sidenavNotificationsSelector).click();
      cy.location("pathname").should("equal", "/notifications");
    };

    beforeEach(function () {
      cy.loginByXstate(ctx.userA.username);
      cy.wait("@getNotifications");

      if (isMobile()) {
        cy.getBySel("sidenav-toggle").click();
      }
      cy.getBySel("sidenav-notifications").click();
      cy.location("pathname").should("equal", "/notifications");
      cy.getBySel("notifications-list").should("exist");
    });

    it("shows every notification the API returns when the toggle is off", function () {
      cy.getBySel(toggleSelector).should("exist").and("contain", "Unread only");
      cy.getBySelLike("notification-list-item").should("have.length", 9);
      cy.getBySel(inputSelector).should("have.attr", "type", "checkbox").and("not.be.checked");
      cy.visualSnapshot("Unread only toggle off by default");
    });

    it("hides the notifications marked as read", function () {
      cy.getBySelLike("notification-list-item")
        .should("have.length", 9)
        .first()
        .invoke("attr", "data-test")
        .then((dataTest) => {
          const firstId = String(dataTest).replace("notification-list-item-", "");

          cy.getBySel(`notification-mark-read-${firstId}`).click({ force: true });
          cy.wait("@updateNotification");

          // the PATCH refetches, so the read row is dropped by the API and eight
          // unread rows remain
          cy.getBySelLike("notification-list-item").should("have.length", 8);

          cy.getBySel(switchSelector).click({ force: true });
          cy.getBySel(inputSelector).should("be.checked");

          // the toggle filters those eight, so the list looks the same and the
          // dismissed row is still absent
          cy.getBySelLike("notification-list-item")
            .should("have.length", 8)
            .first()
            .invoke("attr", "data-test")
            .should("not.equal", `notification-list-item-${firstId}`);
          cy.visualSnapshot("Unread only hides the read notification");
        });
    });

    it("shows the notifications again when switched back off", function () {
      cy.getBySelLike("notification-list-item")
        .should("have.length", 9)
        .first()
        .invoke("attr", "data-test")
        .then((dataTest) => {
          const firstId = String(dataTest).replace("notification-list-item-", "");

          cy.getBySel(`notification-mark-read-${firstId}`).click({ force: true });
          cy.wait("@updateNotification");

          cy.getBySel(switchSelector).click({ force: true });
          cy.getBySel(inputSelector).should("be.checked");
          cy.getBySelLike("notification-list-item").should("have.length", 8);

          cy.getBySel(switchSelector).click({ force: true });
          cy.getBySel(inputSelector).should("not.be.checked");

          // the toggle is back off, so the list is the API's again and still
          // lacks the row the server dropped
          cy.getBySelLike("notification-list-item")
            .should("have.length", 8)
            .each(($item) => {
              cy.wrap($item)
                .invoke("attr", "data-test")
                .should("match", /^notification-list-item-/);
            });
          cy.getBySel(`notification-list-item-${firstId}`).should("not.exist");
          cy.getBySel("empty-list-header").should("not.exist");
          cy.visualSnapshot("Unread only toggle switched back off");
        });
    });

    it("hides the read rows a response still carries", function () {
      // n1 is already read when the page takes the list, so it is the row only
      // this filter can remove
      const rows = stubbedResults(["n1", "n2", "n3", "n4"]);
      rows[0].isRead = true;

      cy.intercept("GET", "/notifications*", { body: { results: rows } }).as(
        "stubbedNotifications"
      );

      refetchStubbedNotifications();

      // off, the filter passes everything through, including the read row, whose
      // text names the user who liked the transaction
      cy.getBySelLike("notification-list-item")
        .should("have.length", 4)
        .first()
        .should("contain", "liked")
        .and("contain", `${ctx.userB.firstName} ${ctx.userB.lastName}`);

      cy.getBySel(switchSelector).click({ force: true });
      cy.getBySel(inputSelector).should("be.checked");

      cy.getBySel("notification-list-item-n1").should("not.exist");
      cy.getBySelLike("notification-list-item")
        .should("have.length", 3)
        .each(($item) => {
          cy.wrap($item)
            .invoke("attr", "data-test")
            .should("not.equal", "notification-list-item-n1");
        });
      cy.visualSnapshot("Unread only hides the read row in the response");

      cy.getBySel(switchSelector).click({ force: true });
      cy.getBySel(inputSelector).should("not.be.checked");

      // back off, the read row shows again without another GET
      cy.getBySel("notification-list-item-n1").should("exist");
      cy.getBySelLike("notification-list-item").should("have.length", 4);
      cy.visualSnapshot("Unread only switched back off shows the read row");
    });

    it("says no unread notifications once every response row is read", function () {
      const rows = stubbedResults(["n1", "n2", "n3", "n4"]);
      rows.forEach((row) => (row.isRead = true));

      cy.intercept("GET", "/notifications*", { body: { results: rows } }).as(
        "stubbedNotifications"
      );

      refetchStubbedNotifications();

      // off, every row still shows, so the list is not empty yet
      cy.getBySelLike("notification-list-item").should("have.length", 4);

      // every row the page holds is read, so the filter empties the list and the
      // empty state names the filtered entity
      cy.getBySel(switchSelector).click({ force: true });
      cy.getBySel(inputSelector).should("be.checked");

      cy.getBySel("notifications-list").should("not.exist");
      cy.getBySel("empty-list-header").should("contain", "No unread notifications");
      cy.visualSnapshot("No unread notifications");
    });
  });

  it("renders an empty notifications state", function () {
    cy.intercept("GET", "/notifications", []).as("notifications");

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
});
