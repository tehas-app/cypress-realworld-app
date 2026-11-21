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
import { Button, FormControlLabel, Paper, Switch, Typography } from "@mui/material";
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
    // fetchData always asks for read and unread rows (`?all=true`), so the page
    // needs no param of its own. The NavBar badge counts the unread subset of
    // these results, not their length.
    sendNotifications({ type: "FETCH" });
  }, [authState, sendNotifications]);

  const updateNotification = (payload: NotificationUpdatePayload) =>
    sendNotifications({ type: "UPDATE", ...payload });

  // The page now loads read rows too, so "unread only" is component-local
  // state rather than a refetch: the rows are already in the machine's context
  // and hiding them is a client-side filter.
  const [unreadOnly, setUnreadOnly] = React.useState(false);
  const visibleNotifications = unreadOnly
    ? notificationsState?.context?.results?.filter((notification) => !notification.isRead)
    : notificationsState?.context?.results;

  // Only unread rows count here: the list itself can hold read rows now that
  // it is fetched with `all=true`.
  const hasUnreadNotifications = Boolean(
    notificationsState?.context?.results?.some((notification) => !notification.isRead)
  );

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
      <FormControlLabel
        control={
          <Switch
            checked={unreadOnly}
            onChange={(event) => setUnreadOnly(event.target.checked)}
            color="primary"
          />
        }
        label="Unread only"
        // The issue names this handle. MUI puts unknown props on the
        // FormControlLabel root, and the Switch's own input is visually hidden,
        // so the e2e spec clicks the copy on the visible `inputProps` below and
        // asserts the checked state on this one.
        data-test="notifications-unread-only"
        inputProps={{ "data-test": "notifications-unread-only-input" }}
      />
      <NotificationList
        notifications={visibleNotifications!}
        unreadOnly={unreadOnly}
        updateNotification={updateNotification}
      />
    </StyledPaper>
  );
};

export default NotificationsContainer;
