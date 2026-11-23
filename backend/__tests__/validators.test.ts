import { describe, expect, it } from "vitest";
import { Request } from "express";
import { isUserValidator } from "../validators";

// Drives the real chain the way validateMiddleware does (backend/helpers.ts), minus the
// response, so the contract the email and phone rules rest on is pinned in the fast gate
// rather than only in a Cypress spec that CI may not run.
const runIsUserValidator = async (body: Record<string, unknown>) => {
  const req: any = { body: JSON.parse(JSON.stringify(body)), query: {}, params: {}, cookies: {} };
  const results = await Promise.all(
    isUserValidator.map((validation: any) => validation.run(req as Request))
  );
  return { errors: results.flatMap((result: any) => result.array()), body: req.body };
};

describe("isUserValidator email and phone number", () => {
  it("rejects an invalid email", async () => {
    const { errors } = await runIsUserValidator({ email: "not-an-email" });
    expect(errors.length).toBe(1);
  });

  it.each([
    "615-555-121",
    "61555512123",
    "6155551212-",
    "(1234567890",
    "1234567890)",
    "615--555-1212",
    "abc",
  ])("rejects the phone number %j", async (phoneNumber) => {
    const { errors } = await runIsUserValidator({ phoneNumber });
    expect(errors.length).toBe(1);
  });

  it.each([
    "6155551212",
    "615-555-1212",
    "615.555.1212",
    "615 555 1212",
    "1-2-3-4-5-6-7-8-9-0",
    "398-225-9900",
  ])("accepts the phone number %j", async (phoneNumber) => {
    const { errors } = await runIsUserValidator({ phoneNumber });
    expect(errors).toStrictEqual([]);
  });

  // One rule, both sides. The regex below is a copy of UserSettingsForm's phoneRegExp and
  // the scan is the one in backend/validators.ts: if either is edited without the other,
  // this fails. (The rule itself cannot be shared as a module - the issue keeps it local to
  // each side - so the cross-check lives here.)
  const frontendRule = (value: string) =>
    /^(?=[\d -.()]*$)(?:\d|(?<=\d)[-. ()](?=\d))+$/.test(value) &&
    (value.match(/\d/g) ?? []).length === 10;

  it.each([
    "6155551212",
    "615-555-1212",
    "(615) 555-1212",
    "615--555-1212",
    "6155551212-",
    "1234567890)",
    "615.555.1212",
    "1.2.3.4.5.6.7.8.9.0",
    "(1234567890",
    "615 555 1212",
  ])("the backend scan agrees with the form regex about %j", async (phoneNumber) => {
    const { errors } = await runIsUserValidator({ phoneNumber });
    expect(errors.length === 0).toBe(frontendRule(phoneNumber));
  });

  it("trims a padded email and phone number", async () => {
    const { errors, body } = await runIsUserValidator({
      email: "  email@email.com  ",
      phoneNumber: " 615-555-1212 ",
    });

    expect(errors).toStrictEqual([]);
    expect(body.email).toBe("email@email.com");
    expect(body.phoneNumber).toBe("615-555-1212");
  });

  // A whitespace-only email or phone number is not falsy, so .optional({ checkFalsy: true })
  // lets it through and the sanitizer turns it into undefined. The PATCH route drops
  // undefined keys before updateUserById, so the stored value is left alone; "" is falsy,
  // is dropped by .optional() first, and is still written as "". The Cypress spec cannot
  // run in the fast gate, so the undefined is asserted here.
  it.each(["   ", " \t ", " \n "])(
    "sends %j as no value at all, so the stored field is left alone",
    async (value) => {
      const { errors, body } = await runIsUserValidator({
        firstName: "New First Name",
        email: value,
        phoneNumber: value,
      });

      expect(errors).toStrictEqual([]);
      expect(body.email).toBeUndefined();
      expect(body.phoneNumber).toBeUndefined();
    }
  );

  // "" is falsy too, so it is dropped as well - but it was falsy before the sanitizer ran,
  // so it stays "" on the body. Pinned because it is the asymmetry the POST /users and
  // PATCH specs document.
  it("keeps an empty string on the body, which assign writes as blank text", async () => {
    const { errors, body } = await runIsUserValidator({
      firstName: "New First Name",
      email: "",
      phoneNumber: "",
    });

    expect(errors).toStrictEqual([]);
    expect(body.email).toBe("");
    expect(body.phoneNumber).toBe("");
  });

  // An oversized value gets both the length error and the rule's own error - express-
  // validator runs the whole chain - which is fine: what matters is that it is rejected
  // outright rather than treated as a possible phone number.
  it("rejects a value too long to be valid without scanning all its digits", async () => {
    const { errors } = await runIsUserValidator({ phoneNumber: "1".repeat(33) });
    expect(errors.length).toBeGreaterThanOrEqual(1);

    const { errors: emailErrors } = await runIsUserValidator({
      email: `${"a".repeat(250)}@email.com`,
    });
    expect(emailErrors.length).toBeGreaterThanOrEqual(1);
  });
});
