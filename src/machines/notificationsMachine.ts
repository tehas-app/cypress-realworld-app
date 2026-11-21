import { isEmpty, omit } from "lodash/fp";
import { dataMachine } from "./dataMachine";
import { httpClient } from "../utils/asyncUtils";
import { apiUrl } from "../utils/portUtils";

// Marks every unread notification of the signed-in user as read. `PATCH
// /notifications` (no id) is issue #3's collection endpoint; it is merged
// after this frontend, so a #4 build against a develop without it 404s.
// The endpoint takes no parameters, so the body is empty.
const markAllNotificationsAsRead = async () => {
  const resp = await httpClient.patch(`${apiUrl}/notifications`, {});
  return resp.data;
};

export const notificationsMachine = dataMachine("notifications").withConfig({
  services: {
    fetchData: async (ctx, event: any) => {
      const payload = omit("type", event);
      const resp = await httpClient.get(`${apiUrl}/notifications`, {
        params: !isEmpty(payload) && event.type === "FETCH" ? payload : undefined,
      });
      return resp.data;
    },
    // The shared `dataMachine` has a single `UPDATE` state and `DataEvents`
    // types it as a bare `{ type: "UPDATE" }`, so "mark all as read" reuses
    // it and is told apart by its payload carrying no `id`. No caller in the
    // app sends `UPDATE` without one (only `NotificationsContainer`, which
    // either spreads a `NotificationUpdatePayload` with an `id` or sends the
    // bare event for mark-all); an `UPDATE` that lost its payload therefore
    // marks all read rather than one row.
    updateData: async (ctx, event: any) => {
      const payload = omit("type", event);
      if (payload.id === undefined) {
        return markAllNotificationsAsRead();
      }
      const resp = await httpClient.patch(`${apiUrl}/notifications/${payload.id}`, payload);
      return resp.data;
    },
  },
});
