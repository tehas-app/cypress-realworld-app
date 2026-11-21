import { describe, expect, it, beforeEach } from "vitest";
import { map, find, uniqBy, includes } from "lodash/fp";
import {
  seedDatabase,
  getTransactionsForUserContacts,
  getAllUsers,
  getTransactionsByUserId,
  getTransactionById,
  createLike,
  createLikes,
  getLikesByTransactionId,
  getNotificationsByUserId,
  createTransaction,
  getBankAccountsByUserId,
} from "../../backend/database";

import {
  User,
  Transaction,
  LikeNotification,
  NotificationType,
  DefaultPrivacyLevel,
  TransactionPayload,
  TransactionStatus,
} from "../../src/models";
import { getFakeAmount, isLikeNotification } from "../utils/transactionUtils";

/** Who a like notification belongs to, and which like it points at. */
type NotifiedLike = Pick<LikeNotification, "userId" | "likeId">;

/**
 * Like notifications recorded for a transaction.
 *
 * The cases below like `transactionUnderTest`, which carries no seeded notification at all
 * (the seed's like notifications sit on six other transactions), so whatever this returns
 * for it was created by the test itself. The notification getters return lowdb's own record
 * type, which has none of the variant fields, so the rows are read as `NotificationType`s
 * to see their `likeId`.
 */
const likeNotificationsFor = (transactionId: string): NotifiedLike[] =>
  getAllUsers().flatMap((user: User) =>
    (getNotificationsByUserId(user.id) as unknown as NotificationType[])
      .filter(isLikeNotification)
      .filter((notification) => notification.transactionId === transactionId)
      .map((notification) => ({ userId: notification.userId, likeId: notification.likeId }))
  );

/** The users a like notification would have been sent to, ignoring who liked it. */
const partiesOf = (transaction: Transaction) =>
  uniqBy("id", [transaction.senderId, transaction.receiverId]);

/**
 * The seeded transaction the like tests start from.
 *
 * `getTransactionsForUserContacts` collects every transaction touching a contact of `user`,
 * not only the ones between `user` and that contact, so this transaction need not have
 * `user` as a party — the cases below assert against its own parties either way. Chosen for
 * two seed facts about it: no seeded like points at it, and it carries no seeded
 * notification. The assertions count rows this file creates.
 */
const transactionUnderTest = (user: User) => getTransactionsForUserContacts(user.id)[0];

/** A seeded user who is neither party of `transaction`. */
const thirdUserOf = (transaction: Transaction) =>
  find(
    (other: User) => other.id !== transaction.senderId && other.id !== transaction.receiverId,
    getAllUsers()
  )!;

/**
 * A transaction sent to oneself, built the way the API builds one. The seed has none: every
 * seeded transaction has two distinct parties, and `createTransaction` notifies only the
 * receiver of a payment — so liking it can add nothing to that user's notifications but a
 * like notification. user[0] has one bank account and no other case here spends it.
 */
const createSelfTransaction = (user: User) => {
  const [bankAccount] = getBankAccountsByUserId(user.id);
  const details: TransactionPayload = {
    source: bankAccount.id!,
    senderId: user.id,
    receiverId: user.id,
    description: `Payment: ${user.id} to ${user.id}`,
    amount: getFakeAmount(),
    privacyLevel: DefaultPrivacyLevel.public,
    status: TransactionStatus.pending,
  };

  return createTransaction(user.id, "payment", details);
};

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
    // getTransactionsByUserId is by receiverId, and this transaction has no seeded like
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

  describe("like notifications", () => {
    let user: User;
    let transaction: Transaction;

    beforeEach(() => {
      user = getAllUsers()[0];
      transaction = transactionUnderTest(user);
    });

    it("should notify the sender and the receiver when someone else likes a transaction", () => {
      const thirdUser: User = thirdUserOf(transaction);

      createLikes(thirdUser.id, transaction.id);

      const notified = likeNotificationsFor(transaction.id);

      expect(includes(thirdUser.id, map("userId", notified))).toBe(false);
      expect(notified).toHaveLength(2);
      // both of them are the parties of the transaction, not bystanders
      expect(map("userId", notified)).toEqual(expect.arrayContaining(partiesOf(transaction)));
    });

    it("should notify the other party when sender and receiver are the same user", () => {
      // the one shape the old condition could tell apart: with a single party, liking your
      // own transaction leaves nobody to notify
      const selfTransaction = createSelfTransaction(user);

      createLikes(user.id, selfTransaction.id);

      expect(likeNotificationsFor(selfTransaction.id)).toHaveLength(0);
    });

    it("should not notify the sender who liked their own transaction", () => {
      createLikes(transaction.senderId, transaction.id);

      const notified = likeNotificationsFor(transaction.id);

      expect(notified).toHaveLength(1);
      expect(notified[0]!.userId).toBe(transaction.receiverId);
    });

    it("should not notify the receiver who liked their own transaction", () => {
      createLikes(transaction.receiverId, transaction.id);

      const notified = likeNotificationsFor(transaction.id);

      expect(notified).toHaveLength(1);
      expect(notified[0]!.userId).toBe(transaction.senderId);
    });

    it("should record the like and one notification per notified party", () => {
      const thirdUser: User = thirdUserOf(transaction);

      createLikes(thirdUser.id, transaction.id);

      const [like] = getLikesByTransactionId(transaction.id);
      expect(like.userId).toBe(thirdUser.id);

      const notified = likeNotificationsFor(transaction.id);
      expect(notified).toHaveLength(2);
      // every notification points at the like just created, and the liker is never notified
      notified.forEach((entry) => expect(entry.likeId).toBe(like.id));
      expect(includes(thirdUser.id, map("userId", notified))).toBe(false);
      expect(getTransactionById(transaction.id).senderId).not.toBe(thirdUser.id);
    });
  });
});
