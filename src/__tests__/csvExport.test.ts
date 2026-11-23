import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../utils/asyncUtils", () => ({ httpClient: { get: vi.fn() } }));

import { httpClient } from "../utils/asyncUtils";
import { apiUrl } from "../utils/portUtils";
import { downloadTransactionsCsv, exportCsvFileName } from "../utils/csvUtils";

const get = vi.mocked(httpClient.get);

// jsdom has neither of the two object URL helpers the download uses, so both are
// stubbed and the calls are what the cases assert on.
const createObjectURL = vi.fn(() => "blob:export");
const revokeObjectURL = vi.fn();

describe("downloadTransactionsCsv", () => {
  let clicked: HTMLAnchorElement[];

  beforeEach(() => {
    get.mockReset();
    get.mockResolvedValue({ data: new Blob(["date,description,sender,receiver,amount,status"]) });
    createObjectURL.mockClear();
    revokeObjectURL.mockClear();
    clicked = [];
    vi.stubGlobal("URL", { ...URL, createObjectURL, revokeObjectURL });
    // jsdom's click does not start a download; record the anchor instead.
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement
    ) {
      clicked.push(this);
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("asks the API for export.csv as a blob, with apiUrl as its prefix", () => {
    return downloadTransactionsCsv({}).then(() => {
      expect(get).toHaveBeenCalledWith(`${apiUrl}/transactions/export.csv`, {
        params: undefined,
        responseType: "blob",
      });
    });
  });

  it("sends the current date and amount filters as the query string", () => {
    const filters = {
      dateRangeStart: "2024-03-01T00:00:00.000Z",
      dateRangeEnd: "2024-03-07T23:59:59.000Z",
      amountMin: 10000,
      amountMax: 20000,
    };

    return downloadTransactionsCsv(filters).then(() => {
      expect(get).toHaveBeenCalledWith(`${apiUrl}/transactions/export.csv`, {
        params: filters,
        responseType: "blob",
      });
    });
  });

  it("saves the response under export.csv", () => {
    const blob = new Blob(["date,description,sender,receiver,amount,status"]);
    get.mockResolvedValue({ data: blob });

    return downloadTransactionsCsv({}).then(() => {
      expect(createObjectURL).toHaveBeenCalledWith(blob);
      expect(clicked).toHaveLength(1);
      expect(clicked[0].getAttribute("download")).toBe("export.csv");
      expect(exportCsvFileName).toBe("export.csv");
      expect(revokeObjectURL).toHaveBeenCalledWith("blob:export");
      // the anchor is only in the document while the click is issued
      expect(document.querySelector("a[download]")).toBeNull();
    });
  });

  it("leaves the failure to the caller rather than saving a partial file", async () => {
    get.mockRejectedValue(new Error("401"));

    await expect(downloadTransactionsCsv({})).rejects.toThrow("401");
    expect(createObjectURL).not.toHaveBeenCalled();
    expect(clicked).toHaveLength(0);
  });
});
