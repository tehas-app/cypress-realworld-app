import React, { useEffect } from "react";
import { styled } from "@mui/material/styles";
import {
  BaseActionObject,
  Interpreter,
  ResolveTypegenMeta,
  ServiceMap,
  TypegenDisabled,
} from "xstate";
import { useActor } from "@xstate/react";
import { Button, Paper, Typography } from "@mui/material";
import { NotificationUpdatePayload } from "../models";
import NotificationList from "../components/NotificationList";
import { DataContext, DataSchema, DataEvents } from "../machines/dataMachine";
import { AuthMachineContext, AuthMachineEvents, AuthMachineSchema } from "../machines/authMachine";

const PREFIX = "NotificationsContainer";

const classes = {
  paper: `${PREFIX}-paper`,
  markAllAsRead: `${PREFIX}-markAllAsRead`,
};

const StyledPaper = styled(Paper)(({ theme }) => ({
  [`&.${classes.paper}`]: {
    minHeight: "90vh",
    padding: theme.spacing(2),
    display: "flex",
    overflow: "auto",
    flexDirection: "column",
  },
}));

const MarkAllAsReadButton = styled(Button)(({ theme }) => ({
  [`&.${classes.markAllAsRead}`]: {
    alignSelf: "flex-end",
    marginBottom: theme.spacing(1),
  },
}));

export interface Props {
  authService: Interpreter<AuthMachineContext, AuthMachineSchema, AuthMachineEvents, any, any>;
  notificationsService: Interpreter<
    DataContext,
    DataSchema,
    DataEvents,
    any,
    ResolveTypegenMeta<TypegenDisabled, DataEvents, BaseActionObject, ServiceMap>
  >;
}

const NotificationsContainer: React.FC<Props> = ({ authService, notificationsService }) => {
  const [authState] = useActor(authService);
  const [notificationsState, sendNotifications] = useActor(notificationsService);

  useEffect(() => {
    sendNotifications({ type: "FETCH" });
  }, [authState, sendNotifications]);

  const updateNotification = (payload: NotificationUpdatePayload) =>
    sendNotifications({ type: "UPDATE", ...payload });

  // `GET /notifications` is served by `getUnreadNotificationsByUserId`
  // (backend/database.ts:700), which filters `isRead: false`, so every row in
  // the machine's context is unread. The gate is coupled to that backend filter.
  const hasUnreadNotifications = Boolean(notificationsState?.context?.results?.length);

  const markAllNotificationsAsRead = () =>
    // No `id` in the payload is what makes notificationsMachine's `updateData`
    // PATCH the collection instead of a single notification.
    sendNotifications({ type: "UPDATE" });

  return (
    <StyledPaper className={classes.paper}>
      <Typography component="h2" variant="h6" color="primary" gutterBottom>
        Notifications
      </Typography>
      {hasUnreadNotifications && (
        <MarkAllAsReadButton
          color="primary"
          size="small"
          onClick={markAllNotificationsAsRead}
          data-test="notifications-mark-all-read"
        >
          Mark all as read
        </MarkAllAsReadButton>
      )}
      <NotificationList
        notifications={notificationsState?.context?.results!}
        updateNotification={updateNotification}
      />
    </StyledPaper>
  );
};

export default NotificationsContainer;
