import React, { useEffect, ReactNode } from "react";
import { useMachine } from "@xstate/react";
import {
  TransactionPagination,
  TransactionResponseItem,
  TransactionDateRangePayload,
  TransactionAmountRangePayload,
  TransactionQueryPayload,
} from "../models";
import TransactionList from "./TransactionList";
import TransactionListExportButton from "./TransactionListExportButton";
import { personalTransactionsMachine } from "../machines/personalTransactionsMachine";

export interface TransactionPersonalListProps {
  filterComponent: ReactNode;
  dateRangeFilters: TransactionDateRangePayload;
  amountRangeFilters: TransactionAmountRangePayload;
}

const TransactionPersonalList: React.FC<TransactionPersonalListProps> = ({
  filterComponent,
  dateRangeFilters,
  amountRangeFilters,
}) => {
  const [current, send, personalTransactionService] = useMachine(personalTransactionsMachine);
  const { pageData, results } = current.context;

  // @ts-ignore
  if (window.Cypress) {
    // @ts-ignore
    window.personalTransactionService = personalTransactionService;
  }

  useEffect(() => {
    send("FETCH", { ...dateRangeFilters, ...amountRangeFilters });
  }, [send, dateRangeFilters, amountRangeFilters]);

  const loadNextPage = (page: number) =>
    send("FETCH", { page, ...dateRangeFilters, ...amountRangeFilters });

  const transactions = results as TransactionResponseItem[];
  // the same payload the list's FETCH sends, so the file holds what the list shows
  const exportFilters: TransactionQueryPayload = { ...dateRangeFilters, ...amountRangeFilters };

  return (
    <>
      <TransactionList
        filterComponent={filterComponent}
        exportComponent={
          <TransactionListExportButton
            filters={exportFilters}
            disabled={transactions?.length === 0}
          />
        }
        header="Personal"
        transactions={transactions}
        isLoading={current.matches("loading")}
        loadNextPage={loadNextPage}
        pagination={pageData as TransactionPagination}
        showCreateButton={true}
      />
    </>
  );
};

export default TransactionPersonalList;
