import { describe, expect, it } from "vitest";
import { faker } from "@faker-js/faker";
import shortid from "shortid";
import { DefaultPrivacyLevel, TransactionStatus, TransactionResponseItem } from "../../src/models";
import {
  escapeCsvField,
  formatDateForExport,
  formatAmountForExport,
  serializeCsvRow,
  serializeTransactionsCsv,
} from "../utils/csvUtils";

const fakeTransactionResponseItem = (overrides: Partial<TransactionResponseItem> = {}) => ({
  id: shortid(),
  uuid: faker.datatype.uuid(),
  source: "",
  amount: 44019,
  description: "Payment: WHjJ4qR2R2 to uBmeaz5pX",
  privacyLevel: DefaultPrivacyLevel.public,
  receiverId: "uBmeaz5pX",
  senderId: "WHjJ4qR2R2",
  status: TransactionStatus.complete,
  createdAt: new Date("2024-03-07T02:07:26.208Z"),
  modifiedAt: new Date("2024-03-07T02:07:26.208Z"),
  likes: [],
  comments: [],
  receiverName: "Ted Parisian",
  receiverAvatar: "https://example.com/receiver.png",
  senderName: "Emma Brown",
  senderAvatar: "https://example.com/sender.png",
  ...overrides,
});

describe("CSV utils", () => {
  describe("escapeCsvField", () => {
    it("leaves a plain field alone", () => {
      expect(escapeCsvField("Payment to Ted")).toBe("Payment to Ted");
    });

    it("quotes a field containing a comma", () => {
      expect(escapeCsvField("Dinner, taxi and coffee")).toBe('"Dinner, taxi and coffee"');
    });

    it("doubles a quote inside a field and quotes the field", () => {
      expect(escapeCsvField('Say "hello"')).toBe('"Say ""hello"""');
    });

    it("quotes a field containing a line break", () => {
      expect(escapeCsvField("Line one\nLine two")).toBe('"Line one\nLine two"');
      expect(escapeCsvField("Line one\r\nLine two")).toBe('"Line one\r\nLine two"');
    });

    it("quotes a field that only holds quotes", () => {
      expect(escapeCsvField('""')).toBe('""""""');
    });

    it("leaves an empty field unquoted", () => {
      expect(escapeCsvField("")).toBe("");
    });
  });

  describe("formatAmountForExport", () => {
    it("renders cents as dollars with two decimals", () => {
      expect(formatAmountForExport(44019)).toBe("440.19");
      expect(formatAmountForExport(100)).toBe("1.00");
      expect(formatAmountForExport(5)).toBe("0.05");
    });

    it("carries no grouping separator", () => {
      expect(formatAmountForExport(123456789)).toBe("1234567.89");
    });
  });

  describe("formatDateForExport", () => {
    it("renders a Date as an ISO 8601 UTC string", () => {
      expect(formatDateForExport(new Date("2024-03-07T02:07:26.208Z"))).toBe(
        "2024-03-07T02:07:26.208Z"
      );
    });

    it("renders a date held as a string the same way", () => {
      expect(formatDateForExport("2024-03-07T02:07:26.208Z")).toBe("2024-03-07T02:07:26.208Z");
    });
  });

  describe("serializeCsvRow", () => {
    it("joins cells with commas and quotes what needs it", () => {
      expect(serializeCsvRow(["2024-03-07", 'Ted "The Ted"', "a,b", "440.19"])).toBe(
        '2024-03-07,"Ted ""The Ted""","a,b",440.19'
      );
    });

    it("leaves a row of plain cells unquoted", () => {
      expect(serializeCsvRow(["complete", "payment", "440.19"])).toBe("complete,payment,440.19");
    });
  });

  describe("serializeTransactionsCsv", () => {
    it("writes a header row and one row per transaction, separated by CRLF", () => {
      const csv = serializeTransactionsCsv([
        fakeTransactionResponseItem(),
        fakeTransactionResponseItem({ amount: 5, status: TransactionStatus.pending }),
      ]);
      const lines = csv.split("\r\n");

      expect(lines[0]).toBe("date,description,sender,receiver,amount,status");
      expect(lines).toHaveLength(3);
      expect(lines[1]).toBe(
        "2024-03-07T02:07:26.208Z,Payment: WHjJ4qR2R2 to uBmeaz5pX,Emma Brown,Ted Parisian,440.19,complete"
      );
      expect(lines[2]).toMatch(/,0\.05,pending$/);
    });

    it("quotes a description holding a comma, a quote and a newline", () => {
      const csv = serializeTransactionsCsv([
        fakeTransactionResponseItem({ description: 'Dinner, "the guys"\nand taxi' }),
      ]);

      expect(csv.split("\r\n")[1]).toMatch(
        /^2024-03-07T02:07:26\.208Z,"Dinner, ""the guys""\nand taxi",/
      );
    });

    it("writes just the header when there are no transactions", () => {
      expect(serializeTransactionsCsv([])).toBe("date,description,sender,receiver,amount,status");
    });
  });
});
