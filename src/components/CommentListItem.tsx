import React, { useState } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Grid,
  IconButton,
  ListItem,
  ListItemText,
} from "@mui/material";
import { Delete as DeleteIcon } from "@mui/icons-material";

import { Comment, User } from "../models";

export interface CommentListItemProps {
  comment: Comment;
  currentUser: User;
  commentDelete: (payload: { transactionId: string; commentId: string }) => void;
}

const CommentListItem: React.FC<CommentListItemProps> = ({
  comment,
  currentUser,
  commentDelete,
}) => {
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const isAuthor = currentUser.id === comment.userId;

  const closeConfirmDialog = () => setConfirmDeleteOpen(false);

  const confirmDeleteComment = () => {
    setConfirmDeleteOpen(false);
    commentDelete({ transactionId: comment.transactionId, commentId: comment.id });
  };

  return (
    <ListItem data-test={`comment-list-item-${comment.id}`}>
      <Grid container direction="row" justifyContent="space-between" alignItems="center">
        <Grid item xs>
          <ListItemText primary={`${comment.content}`} />
        </Grid>
        {isAuthor && (
          <Grid item>
            <IconButton
              color="secondary"
              data-test={`comment-delete-${comment.id}`}
              onClick={() => setConfirmDeleteOpen(true)}
              size="large"
            >
              <DeleteIcon />
            </IconButton>
          </Grid>
        )}
      </Grid>
      <Dialog
        open={confirmDeleteOpen}
        onClose={closeConfirmDialog}
        data-test={`comment-delete-dialog-${comment.id}`}
      >
        <DialogTitle>Delete comment</DialogTitle>
        <DialogContent>
          <DialogContentText>This comment will be removed from the transaction.</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button color="primary" data-test="comment-delete-cancel" onClick={closeConfirmDialog}>
            Cancel
          </Button>
          <Button
            color="secondary"
            data-test="comment-delete-confirm"
            onClick={confirmDeleteComment}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </ListItem>
  );
};

export default CommentListItem;
