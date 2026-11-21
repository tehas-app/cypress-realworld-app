import React from "react";
import { List } from "@mui/material";

import NotificationListItem from "./NotificationListItem";
import { NotificationResponseItem } from "../models";
import EmptyList from "./EmptyList";
import RemindersIllustration from "./SvgUndrawReminders697P";

export interface NotificationsListProps {
  notifications: NotificationResponseItem[];
  /** Only the unread rows are shown; decides the empty-state copy. */
  unreadOnly: boolean;
  updateNotification: Function;
}

const NotificationsList: React.FC<NotificationsListProps> = ({
  notifications,
  unreadOnly,
  updateNotification,
}) => {
  return (
    <>
      {notifications?.length > 0 ? (
        <List data-test="notifications-list">
          {notifications.map((notification: NotificationResponseItem) => (
            <NotificationListItem
              key={notification.id}
              notification={notification}
              updateNotification={updateNotification}
            />
          ))}
        </List>
      ) : (
        // With "Unread only" on, an empty list means every notification was
        // read, so the copy names that rather than "No Notifications".
        // EmptyList renders "No {entity}", so the entity reads lower-case here.
        <EmptyList entity={unreadOnly ? "unread notifications" : "Notifications"}>
          <RemindersIllustration style={{ height: 200, width: 250, marginBottom: 30 }} />
        </EmptyList>
      )}
    </>
  );
};

export default NotificationsList;
