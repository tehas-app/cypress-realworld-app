import React, { useState } from "react";
import { Button } from "@mui/material";
import { Download as DownloadIcon } from "@mui/icons-material";
import { TransactionQueryPayload } from "../models";
import { downloadTransactionsCsv } from "../utils/csvUtils";

export type TransactionListExportButtonProps = {
  // the date and amount filters the list is currently showing, as query params
  filters: TransactionQueryPayload;
  // the button does nothing useful on an empty list, so it stays disabled
  disabled?: boolean;
};

// Lives on the personal list alone: the shared filter node is built once and
// passed to all three tabs, so a button inside it would leak onto Everyone and
// Friends.
const TransactionListExportButton: React.FC<TransactionListExportButtonProps> = ({
  filters,
  disabled = false,
}) => {
  const [exporting, setExporting] = useState(false);

  const exportCsv = async () => {
    setExporting(true);
    try {
      await downloadTransactionsCsv(filters);
    } finally {
      setExporting(false);
    }
  };

  return (
    <Button
      data-test="transaction-list-export"
      variant="text"
      color="primary"
      size="small"
      startIcon={<DownloadIcon />}
      disabled={disabled || exporting}
      onClick={exportCsv}
    >
      Export CSV
    </Button>
  );
};

export default TransactionListExportButton;
