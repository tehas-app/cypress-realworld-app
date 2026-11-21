import { describe, expect, it, beforeEach } from "vitest";
import {
  seedDatabase,
  getTransactionsForUserContacts,
  getAllUsers,
  getTransactionsByUserId,
  createLike,
  createLikes,
  getLikesByTransactionId,
  getTransactionById,
} from "../../backend/database";

import { User, Transaction } from "../../src/models";

describe("Transactions", () => {
  beforeEach(() => {
    seedDatabase();
  });

  it("should like a transaction for a contact", () => {
    const user: User = getAllUsers()[0];
    const transactions: Transaction[] = getTransactionsForUserContacts(user.id);

    const like = createLike(user.id, transactions[0].id);

    expect(like.transactionId).toBe(transactions[0].id);
  });

  it("should get a list of likes for a transaction", () => {
    const user: User = getAllUsers()[0];
    const transactions: Transaction[] = getTransactionsByUserId(user.id);
    const transaction = transactions[0];

    createLike(user.id, transaction.id);

    const likes = getLikesByTransactionId(transaction.id);

    expect(likes[0].transactionId).toBe(transaction.id);
  });

  it("should not like the same transaction twice", () => {
    // seeded likes: users[0] likes both of these transactions already
    const transactionId = "fjqzbjqfkR-k";
    const otherTransactionId = "5XZ9RwhG4qW9";

    const likesBefore = getLikesByTransactionId(transactionId);
    const otherLikesBefore = getLikesByTransactionId(otherTransactionId);

    expect(likesBefore).toHaveLength(1);
    expect(likesBefore[0].userId).toBe(getAllUsers()[0].id);

    createLikes(likesBefore[0].userId, transactionId);
    createLikes(likesBefore[0].userId, transactionId);

    const likesAfter = getLikesByTransactionId(transactionId);

    expect(likesAfter).toHaveLength(1);
    expect(likesAfter[0].id).toBe(likesBefore[0].id);

    // only the repeated like is skipped, not the whole call
    expect(getLikesByTransactionId(otherTransactionId)).toHaveLength(otherLikesBefore.length);
  });

  it("should like a transaction a user has not liked yet", () => {
    // the sender of this transaction is a contact of users[0] and has not liked it
    const transactionId = "fjqzbjqfkR-k";
    const { senderId } = getTransactionById(transactionId);

    expect(getLikesByTransactionId(transactionId).map((like) => like.userId)).not.toContain(
      senderId
    );

    createLikes(senderId, transactionId);
    const likesAfterFirstLike = getLikesByTransactionId(transactionId);

    expect(likesAfterFirstLike).toHaveLength(2);
    expect(likesAfterFirstLike.map((like) => like.userId)).toContain(senderId);

    createLikes(senderId, transactionId);

    const likesAfterRepeatLike = getLikesByTransactionId(transactionId);

    expect(likesAfterRepeatLike).toHaveLength(2);
  });
});
