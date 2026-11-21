import React from "react";
import { List } from "@mui/material";

import CommentListItem from "./CommentListItem";
import { Comment, User } from "../models";

export interface CommentsListProps {
  comments: Comment[];
  currentUser: User;
  commentDelete: (payload: { transactionId: string; commentId: string }) => void;
}

const CommentsList: React.FC<CommentsListProps> = ({ comments, currentUser, commentDelete }) => {
  return (
    <List data-test="comments-list">
      {comments &&
        comments.map((comment: Comment) => (
          <CommentListItem
            key={comment.id}
            comment={comment}
            currentUser={currentUser}
            commentDelete={commentDelete}
          />
        ))}
    </List>
  );
};

export default CommentsList;
