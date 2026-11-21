import { faker } from "@faker-js/faker";
import { isEqual } from "lodash/fp";
import { User, NotificationType, Transaction, BankAccount } from "../../../src/models";

type TestTransactionsCtx = {
  receiver?: User;
  authenticatedUser?: User;
  transactionId?: string;
  notificationId?: string;
  bankAccountId?: string;
  // pending payment request sent by authenticatedUser to receiver
  pendingRequestId?: string;
  // a payment the signed-in user sent, priced below the export cases' amount window
  pricedOut?: Transaction;
  // a payment the signed-in user sent, priced inside that window
  pricedIn?: Transaction;
};

const getFakeAmount = () => parseInt(faker.finance.amount(), 10);
const apiTransactions = `${Cypress.expose("apiUrl")}/transactions`;

// The export's columns and filters are what these cases pin down, so the body is
// read as CSV rather than matched byte for byte.
const csvHeader = "date,description,sender,receiver,amount,status";
// the dollars the amount column shows, and the cents the API's amountMin/amountMax
// are compared against (a Transaction.amount is cents)
const amountWindow = {
  minDollars: 100,
  minCents: 10000,
  maxDollars: 200,
  maxCents: 20000,
};
const dollars = (cents: number) => (cents / 100).toFixed(2);

// RFC 4180 split: a comma inside a quoted field belongs to that field, and a
// doubled quote stands for one quote.
const parseCsvRow = (row: string): string[] => {
  const cells: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < row.length; index += 1) {
    const character = row[index];

    if (character === '"') {
      if (quoted && row[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      cells.push(cell);
      cell = "";
    } else {
      cell += character;
    }
  }

  cells.push(cell);
  return cells;
};

const parseCsvExport = (body: string) => {
  const [header, ...rows] = body.split("\r\n");
  return { header, rows: rows.map(parseCsvRow) };
};

describe("Transactions API", function () {
  let ctx: TestTransactionsCtx = {};

  before(() => {
    // Hacky workaround to have the e2e tests pass when cy.visit('http://localhost:3000') is called
    cy.request("GET", "/");
  });

  const isSenderOrReceiver = ({ senderId, receiverId }: Transaction) =>
    isEqual(senderId, ctx.authenticatedUser!.id) || isEqual(receiverId, ctx.authenticatedUser!.id);

  beforeEach(function () {
    cy.task("db:seed");

    cy.database("filter", "users").then((users: User[]) => {
      ctx.authenticatedUser = users[0];
      ctx.receiver = users[1];

      return cy.loginByApi(ctx.authenticatedUser.username);
    });

    cy.database("find", "transactions").then((transaction: Transaction) => {
      ctx.transactionId = transaction.id;
    });

    // ctx is filled when the users' query runs, after this hook has queued
    // its commands: read it inside a then, not while queueing.
    cy.then(() =>
      cy
        .database("filter", "transactions", {
          senderId: ctx.authenticatedUser!.id,
          receiverId: ctx.receiver!.id,
          requestStatus: "pending",
        })
        .then((transactions: Transaction[]) => {
          ctx.pendingRequestId = transactions[0].id;
        })
    );

    cy.database("find", "notifications").then((notification: NotificationType) => {
      ctx.notificationId = notification.id;
    });

    cy.database("find", "bankaccounts").then((bankaccount: BankAccount) => {
      ctx.bankAccountId = bankaccount.id;
    });

    // ditto: the signed-in user is known only once the users' query has run
    cy.then(() =>
      cy
        .database("filter", "transactions", {
          senderId: ctx.authenticatedUser!.id,
          status: "complete",
        })
        .then((payments: Transaction[]) => {
          ctx.pricedOut = payments.find(
            (payment: Transaction) => payment.amount < amountWindow.minCents
          );
          ctx.pricedIn = payments.find(
            (payment: Transaction) =>
              payment.amount >= amountWindow.minCents && payment.amount < amountWindow.maxCents
          );

          expect(ctx.pricedOut, "seed has a payment priced below the export window").to.be.an(
            "object"
          );
          expect(ctx.pricedIn, "seed has a payment priced inside the export window").to.be.an(
            "object"
          );
        })
    );
  });

  context("GET /transactions", function () {
    it("gets a list of transactions for user (default)", function () {
      cy.request("GET", `${apiTransactions}`).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.results[0]).to.satisfy(isSenderOrReceiver);
      });
    });

    it("gets a list of pending request transactions for user", function () {
      cy.request({
        method: "GET",
        url: `${apiTransactions}`,
        qs: {
          requestStatus: "pending",
        },
      }).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.results[0]).to.satisfy(isSenderOrReceiver);
      });
    });

    it("gets a list of pending request transactions for user between a time range", function () {
      cy.request({
        method: "GET",
        url: `${apiTransactions}`,
        qs: {
          requestStatus: "pending",
          dateRangeStart: new Date("Jan 01 2018"),
          dateRangeEnd: new Date("Dec 05 2030"),
        },
      }).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.results[0]).to.satisfy(isSenderOrReceiver);
      });
    });
  });

  context("GET /transactions/contacts", function () {
    it("gets a list of transactions for users list of contacts, page one", function () {
      cy.request("GET", `${apiTransactions}/contacts`).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.results).length.to.be.greaterThan(1);
      });
    });

    it("gets a list of transactions for users list of contacts, page two", function () {
      cy.request("GET", `${apiTransactions}/contacts?page=2`).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.results).length.to.be.greaterThan(1);
      });
    });
  });

  context("GET /transactions/public", function () {
    it("gets a list of public transactions", function () {
      cy.request("GET", `${apiTransactions}/public`).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.results).length.to.be.greaterThan(1);
      });
    });
  });

  context("GET /transactions/export.csv", function () {
    const exportCsv = (qs?: { [key: string]: string }) =>
      cy.request({ method: "GET", url: `${apiTransactions}/export.csv`, qs });

    it("serves the signed-in user's transactions as a CSV attachment", function () {
      exportCsv().then((response) => {
        expect(response.status).to.eq(200);
        expect(response.headers["content-type"]).to.include("text/csv");
        expect(response.headers["content-disposition"]).to.eq(
          'attachment; filename="transactions.csv"'
        );

        const { header, rows } = parseCsvExport(response.body);
        expect(header).to.eq(csvHeader);
        expect(rows.length).to.be.greaterThan(1);

        const signedIn = `${ctx.authenticatedUser!.firstName} ${ctx.authenticatedUser!.lastName}`;
        rows.forEach((cells) => {
          const [date, , sender, receiver, amount, status] = cells;
          expect(cells).to.have.length(6);
          expect([sender, receiver], "row belongs to the signed-in user").to.include(signedIn);
          expect(Number.isNaN(Date.parse(date)), `date cell parses: ${date}`).to.equal(false);
          expect(Number(amount)).to.be.at.least(0);
          expect(status).to.be.oneOf(["complete", "pending", "incomplete"]);
        });
      });
    });

    it("keeps only the transactions inside the amount range", function () {
      const qs = {
        amountMin: `${amountWindow.minCents}`,
        amountMax: `${amountWindow.maxCents}`,
      };

      exportCsv(qs)
        .then((filtered) => exportCsv().then((all) => [filtered, all] as const))
        .then(([filtered, all]) => {
          expect(filtered.status).to.eq(200);

          const { header, rows } = parseCsvExport(filtered.body);
          expect(header).to.eq(csvHeader);
          // the window is narrow but not empty, and it does cut rows out
          expect(rows.length).to.be.greaterThan(1);
          expect(rows.length).to.be.lessThan(parseCsvExport(all.body).rows.length);

          rows.forEach((cells) => {
            const amount = Number(cells[4]);
            // dollars with two decimals: no cents, no grouping separator
            expect(cells[4], `amount cell is dollars: ${cells[4]}`).to.match(/^\d+\.\d{2}$/);
            expect(amount).to.be.at.least(amountWindow.minDollars);
            expect(amount).to.be.below(amountWindow.maxDollars);
          });
        });
    });

    it("drops the user's transactions outside the amount range", function () {
      const pricedOut = ctx.pricedOut!;
      const pricedIn = ctx.pricedIn!;

      const qs = {
        amountMin: `${amountWindow.minCents}`,
        amountMax: `${amountWindow.maxCents}`,
      };

      exportCsv(qs).then((response) => {
        const amounts = parseCsvExport(response.body).rows.map((cells) => cells[4]);

        expect(amounts, "payment priced below the window is gone").to.not.include(
          dollars(pricedOut.amount)
        );
        expect(amounts, "payment priced inside the window is kept").to.include(
          dollars(pricedIn.amount)
        );
      });
    });

    it("keeps only the transactions inside the date range", function () {
      const dateRangeStart = new Date("Mar 06 2024 12:00:00 GMT").toISOString();
      const dateRangeEnd = new Date("Mar 07 2024 23:59:59 GMT").toISOString();

      exportCsv({ dateRangeStart, dateRangeEnd })
        .then((filtered) => exportCsv().then((all) => [filtered, all] as const))
        .then(([filtered, all]) => {
          expect(filtered.status).to.eq(200);

          const { header, rows } = parseCsvExport(filtered.body);
          expect(header).to.eq(csvHeader);
          expect(rows.length).to.be.greaterThan(1);
          expect(rows.length).to.be.lessThan(parseCsvExport(all.body).rows.length);

          const start = new Date(dateRangeStart).getTime();
          const end = new Date(dateRangeEnd).getTime();

          rows.forEach((cells) => {
            const created = new Date(cells[0]).getTime();
            expect(created, `created within window: ${cells[0]}`).to.be.at.least(start);
            expect(created, `created within window: ${cells[0]}`).to.be.at.most(end);
          });
        });

      // a window holding no seeded transaction exports the header alone
      exportCsv({
        dateRangeStart: new Date("Jan 01 2018").toISOString(),
        dateRangeEnd: new Date("Dec 31 2018").toISOString(),
      }).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body).to.eq(csvHeader);
      });
    });

    it("refuses an export for a signed-out session", function () {
      cy.request({
        method: "POST",
        url: `${Cypress.expose("apiUrl")}/logout`,
        followRedirect: false,
      })
        .then(() =>
          cy.request({
            method: "GET",
            url: `${apiTransactions}/export.csv`,
            failOnStatusCode: false,
          })
        )
        .then((response) => {
          expect(response.status).to.eq(401);
        });
    });
  });

  context("POST /transactions", function () {
    it("creates a new payment", function () {
      cy.request("POST", `${apiTransactions}`, {
        transactionType: "payment",
        source: ctx.bankAccountId,
        receiverId: ctx.receiver!.id,
        description: `Payment: ${ctx.authenticatedUser!.id} to ${ctx.receiver!.id}`,
        amount: getFakeAmount(),
        privacyLevel: "public",
      }).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.transaction.id).to.be.a("string");
        expect(response.body.transaction.status).to.eq("complete");
        expect(response.body.transaction.requestStatus).to.eq(undefined);
      });
    });

    it("creates a new request", function () {
      cy.request("POST", `${apiTransactions}`, {
        transactionType: "request",
        source: ctx.bankAccountId,
        receiverId: ctx.receiver!.id,
        description: `Request: ${ctx.authenticatedUser!.id} from ${ctx.receiver!.id}`,
        amount: getFakeAmount(),
        privacyLevel: "public",
      }).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.transaction.id).to.be.a("string");
        expect(response.body.transaction.status).to.eq("pending");
        expect(response.body.transaction.requestStatus).to.eq("pending");
      });
    });
  });

  context("PATCH /transactions/:transactionId", function () {
    it("errors when an invalid field sent", function () {
      cy.request({
        method: "PATCH",
        url: `${apiTransactions}/${ctx.transactionId}`,
        failOnStatusCode: false,
        body: {
          notATransactionField: "not a transaction field",
        },
      }).then((response) => {
        expect(response.status).to.eq(422);
        expect(response.body.errors.length).to.eq(1);
      });
    });

    it("lets the receiver reject a pending request", function () {
      cy.loginByApi(ctx.receiver!.username).then(() =>
        cy
          .request("PATCH", `${apiTransactions}/${ctx.pendingRequestId}`, {
            requestStatus: "rejected",
          })
          .then((response) => {
            expect(response.status).to.eq(204);
          })
      );
    });

    it("lets the receiver accept a pending request", function () {
      cy.loginByApi(ctx.receiver!.username).then(() =>
        cy
          .request("PATCH", `${apiTransactions}/${ctx.pendingRequestId}`, {
            requestStatus: "accepted",
          })
          .then((response) => {
            expect(response.status).to.eq(204);
          })
      );
    });

    it("does not let the sender resolve their own request", function () {
      cy.request({
        method: "PATCH",
        url: `${apiTransactions}/${ctx.pendingRequestId}`,
        failOnStatusCode: false,
        body: { requestStatus: "accepted" },
      }).then((response) => {
        expect(response.status).to.eq(403);
      });
    });

    it("does not let a third user resolve someone else's request", function () {
      cy.database("filter", "users")
        .then((users: User[]) => {
          const thirdUser = users.find(
            (user: User) => user.id !== ctx.authenticatedUser!.id && user.id !== ctx.receiver!.id
          )!;

          return cy.loginByApi(thirdUser.username).then(() =>
            cy.request({
              method: "PATCH",
              url: `${apiTransactions}/${ctx.pendingRequestId}`,
              failOnStatusCode: false,
              body: { requestStatus: "accepted" },
            })
          );
        })
        .then((response) => {
          expect(response.status).to.eq(403);
        });
    });

    it("errors when the transaction does not exist", function () {
      // a well-formed short id that no seeded transaction carries
      cy.request({
        method: "PATCH",
        url: `${apiTransactions}/zzzzzzzzzzzzzzz`,
        failOnStatusCode: false,
        body: { requestStatus: "rejected" },
      }).then((response) => {
        expect(response.status).to.eq(404);
      });
    });
  });
});
