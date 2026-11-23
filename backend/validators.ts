import { body, check, oneOf, query, sanitizeQuery } from "express-validator";
import { isValid } from "shortid";
import isEmail from "validator/lib/isEmail";
import {
  TransactionStatus,
  TransactionRequestStatus,
  DefaultPrivacyLevel,
  NotificationsType,
} from "../src/models";
import { includes } from "lodash/fp";

const TransactionStatusValues = Object.values(TransactionStatus);
const RequestStatusValues = Object.values(TransactionRequestStatus);
const DefaultPrivacyLevelValues = Object.values(DefaultPrivacyLevel);
const NotificationsTypeValues = Object.values(NotificationsType);

// Validators

const isShortId = (value: string) => isValid(value);

// How much text either rule below may scan. Both reject anything well before these lengths
// - isEmail caps an address at 254 characters and ten digits need at most 19 - so the bound
// only keeps an oversized value off the character-by-character work.
const MAX_PHONE_LENGTH = 32;
const MAX_EMAIL_LENGTH = 254;

// The same rule UserSettingsForm's phoneRegExp states: ten digits, only space, dot, dash
// and parentheses beyond them, and at most one of those between two digits - none at either
// end - so "615-555-1212" passes while "6155551212-", "1234567890)" and "615--555-1212" do
// not. Single pass over the value, no array of digits, and it gives up as soon as an
// eleventh digit shows up.
const isPhoneNumber = (value: string) => {
  let digits = 0;
  let expectingDigit = false;
  for (const char of value) {
    if (char >= "0" && char <= "9") {
      digits += 1;
      if (digits > 10) {
        return false;
      }
      expectingDigit = false;
    } else if (!"-. ()".includes(char) || digits === 0 || expectingDigit) {
      return false;
    } else {
      expectingDigit = true;
    }
  }
  return digits === 10 && !expectingDigit;
};

// A whitespace-only email or phone number is not falsy, so .optional({ checkFalsy: true })
// lets it through; this sanitizer turns it into undefined before .trim() can make it "", and
// the rules after it skip it. The PATCH route then drops undefined keys before the update,
// because lodash's assign would otherwise write the undefined over the stored value. ""
// itself is falsy, so it is dropped by .optional() and reaches the update as "".
const trimToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

export const shortIdValidation = (key: string) => check(key).custom(isShortId);

export const searchValidation = query("q").exists();

export const userFieldsValidator = oneOf([
  check("firstName").exists(),
  check("lastName").exists(),
  check("password").exists(),
  check("balance").exists(),
  check("avatar").exists(),
  check("defaultPrivacyLevel").exists(),
  check("email").exists(),
  check("phoneNumber").exists(),
]);

export const isBankAccountValidator = [
  body("bankName").isString().trim(),
  body("accountNumber").isString().trim(),
  body("routingNumber").isString().trim(),
];

export const isUserValidator = [
  check("firstName").optional({ checkFalsy: true }).isString().trim(),
  check("lastName").optional({ checkFalsy: true }).isString().trim(),
  check("username").optional({ checkFalsy: true }).isString().trim(),
  check("password").optional({ checkFalsy: true }).isString().trim(),
  // Absent or blank email/phone means a PATCH that does not touch the field, not an
  // error. POST /users shares this chain, so a signup that sends "" is still accepted;
  // cypress/tests/api/api-users.spec.ts pins that answer, and backend/__tests__/validators
  // .test.ts pins the whitespace behaviour behind it.
  check("email")
    .optional({ checkFalsy: true })
    .customSanitizer(trimToUndefined)
    .isString()
    .isLength({ max: MAX_EMAIL_LENGTH })
    .trim()
    .custom((value: string) => isEmail(value)),
  check("phoneNumber")
    .optional({ checkFalsy: true })
    .customSanitizer(trimToUndefined)
    .isString()
    .isLength({ max: MAX_PHONE_LENGTH })
    .trim()
    .custom((value: string) => isPhoneNumber(value)),
  check("balance").optional({ checkFalsy: true }).isNumeric().trim(),
  check("avatar").optional({ checkFalsy: true }).isURL().trim(),
  check("defaultPrivacyLevel")
    .optional({ checkFalsy: true })
    .isIn(["public", "private", "contacts"]),
];

export const sanitizeTransactionStatus = sanitizeQuery("status").customSanitizer((value) => {
  /* istanbul ignore if*/
  if (includes(value, TransactionStatusValues)) {
    return value;
  }
  return;
});

// default request status to undefined if not provided
export const sanitizeRequestStatus = sanitizeQuery("requestStatus").customSanitizer((value) => {
  /* istanbul ignore if*/
  if (includes(value, RequestStatusValues)) {
    return value;
  }
  return;
});

export const isTransactionQSValidator = [
  query("status").isIn(TransactionStatusValues).optional().trim(),
  query("requestStatus").optional({ checkFalsy: true }).isIn(RequestStatusValues).trim(),
  query("receiverId").optional({ checkFalsy: true }).isString().trim(),
  query("senderId").optional({ checkFalsy: true }).isString().trim(),
  query("rangeStartTs").optional({ checkFalsy: true }).isString().trim(),
  query("rangeEndTs").optional({ checkFalsy: true }).isString().trim(),
  query("amountMax").optional({ checkFalsy: true }).isNumeric().trim(),
  query("amountMin").optional({ checkFalsy: true }).isNumeric().trim(),
];

export const isTransactionPayloadValidator = [
  body("transactionType").isIn(["payment", "request"]).trim(),
  body("privacyLevel").optional().isIn(DefaultPrivacyLevelValues).trim(),
  body("source").optional().isString().trim(),
  body("receiverId").isString().trim(),
  body("description").isString().trim(),
  body("amount").isNumeric().trim().toInt(),
];

export const isTransactionPatchValidator = [body("requestStatus").isIn(RequestStatusValues)];

export const isTransactionPublicQSValidator = [
  query("order").optional({ checkFalsy: true }).isIn(["default"]),
];

export const isCommentValidator = body("content").isString().trim();

export const isNotificationsBodyValidator = [
  body("items.*.type").isIn(NotificationsTypeValues).trim(),
  body("items.*.transactionId").custom(isShortId),
];

export const isNotificationPatchValidator = [body("isRead").isBoolean()];

export const isValidEntityValidator = [
  check("entity")
    .isIn([
      "users",
      "contacts",
      "bankaccounts",
      "notifications",
      "transactions",
      "likes",
      "comments",
      "banktransfers",
    ])
    .trim(),
];
