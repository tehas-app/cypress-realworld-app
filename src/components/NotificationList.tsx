import React, { useState } from "react";
import { Box, FormControlLabel, List, Switch } from "@mui/material";

import NotificationListItem from "./NotificationListItem";
import { NotificationResponseItem } from "../models";
import EmptyList from "./EmptyList";
import RemindersIllustration from "./SvgUndrawReminders697P";

export interface NotificationsListProps {
  notifications: NotificationResponseItem[];
  updateNotification: Function;
}

const NotificationsList: React.FC<NotificationsListProps> = ({
  notifications,
  updateNotification,
}) => {
  const [unreadOnly, setUnreadOnly] = useState(false);

  // The API only ever returns unread rows (getUnreadNotificationsByUserId pins
  // isRead:false), so this filter is what makes the toggle do something: it
  // drops the rows a Dismiss has marked read in the list the page is already
  // holding. The spec's stubbed GET is what puts a read row in that list.
  const visibleNotifications = unreadOnly
    ? notifications?.filter((notification) => !notification.isRead)
    : notifications;

  return (
    <>
      <Box display="flex" justifyContent="flex-end" data-test="notifications-unread-only">
        <FormControlLabel
          control={
            <Switch
              color="primary"
              checked={unreadOnly}
              onChange={(event) => setUnreadOnly(event.target.checked)}
              // MUI puts the spread props on the SwitchBase <span>, so the real
              // checkbox needs its own selector for state assertions to resolve
              // to something that can be checked.
              data-test="notifications-unread-only-switch"
              inputProps={{ "data-test": "notifications-unread-only-input" }}
            />
          }
          label="Unread only"
        />
      </Box>
      {visibleNotifications?.length > 0 ? (
        <List data-test="notifications-list">
          {visibleNotifications.map((notification: NotificationResponseItem) => (
            <NotificationListItem
              key={notification.id}
              notification={notification}
              updateNotification={updateNotification}
            />
          ))}
        </List>
      ) : (
        <EmptyList entity={unreadOnly ? "unread notifications" : "Notifications"}>
          <RemindersIllustration style={{ height: 200, width: 250, marginBottom: 30 }} />
        </EmptyList>
      )}
    </>
  );
};

export default NotificationsList;
