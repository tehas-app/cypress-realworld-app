///<reference path="types.ts" />

import express, { Request, Response, NextFunction } from "express";
import { isEqual } from "lodash/fp";

import {
  getContactsByUsername,
  getContactById,
  removeContactById,
  createContactForUser,
} from "./database";
import { ensureAuthenticated, validateMiddleware } from "./helpers";
import { shortIdValidation } from "./validators";
const router = express.Router();

// Routes
//GET /contacts/:username
router.get("/:username", (req, res) => {
  const { username } = req.params;

  const contacts = getContactsByUsername(username);

  res.status(200);
  res.json({ contacts });
});

//POST /contacts (scoped-user)
router.post(
  "/",
  ensureAuthenticated,
  validateMiddleware([shortIdValidation("contactUserId")]),
  (req, res) => {
    const { contactUserId } = req.body;
    /* istanbul ignore next */
    const contact = createContactForUser(req.user?.id!, contactUserId);

    res.status(200);
    res.json({ contact });
  }
);
// only the user a contact belongs to may delete it
const ensureContactOwner = (req: Request, res: Response, next: NextFunction) => {
  const contact = getContactById(req.params.contactId);

  if (!contact) {
    return res.sendStatus(404);
  }

  if (!isEqual(contact.userId, req.user?.id)) {
    return res.sendStatus(403);
  }

  return next();
};

//DELETE /contacts/:contactId (scoped-user)
router.delete(
  "/:contactId",
  ensureAuthenticated,
  validateMiddleware([shortIdValidation("contactId")]),
  ensureContactOwner,
  (req, res) => {
    const { contactId } = req.params;

    const contacts = removeContactById(contactId);

    res.status(200);
    res.json({ contacts });
  }
);

export default router;
