///<reference path="types.ts" />

import express, { Request, Response, NextFunction } from "express";
import { isEqual } from "lodash/fp";
import {
  getCommentsByTransactionId,
  createComments,
  getCommentById,
  removeCommentById,
} from "./database";
import { ensureAuthenticated, validateMiddleware } from "./helpers";
import { shortIdValidation, isCommentValidator } from "./validators";
const router = express.Router();

// Routes

//GET /comments/:transactionId
router.get(
  "/:transactionId",
  ensureAuthenticated,
  validateMiddleware([shortIdValidation("transactionId")]),
  (req, res) => {
    const { transactionId } = req.params;
    const comments = getCommentsByTransactionId(transactionId);

    res.status(200);
    res.json({ comments });
  }
);

//POST /comments/:transactionId
router.post(
  "/:transactionId",
  ensureAuthenticated,
  validateMiddleware([shortIdValidation("transactionId"), isCommentValidator]),
  (req, res) => {
    const { transactionId } = req.params;
    const { content } = req.body;

    /* istanbul ignore next */
    createComments(req.user?.id!, transactionId, content);

    res.sendStatus(200);
  }
);

// only the author of a comment may delete it
const ensureCommentAuthor = (req: Request, res: Response, next: NextFunction) => {
  const comment = getCommentById(req.params.commentId);

  if (!comment) {
    return res.sendStatus(404);
  }

  if (!isEqual(comment.userId, req.user?.id)) {
    return res.sendStatus(403);
  }

  return next();
};

//DELETE /comments/:transactionId/:commentId - scoped-user
router.delete(
  "/:transactionId/:commentId",
  ensureAuthenticated,
  validateMiddleware([shortIdValidation("transactionId"), shortIdValidation("commentId")]),
  ensureCommentAuthor,
  (req, res) => {
    const { commentId } = req.params;

    removeCommentById(commentId);

    res.sendStatus(204);
  }
);

export default router;
