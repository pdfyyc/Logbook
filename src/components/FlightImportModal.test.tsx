// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { Aircraft } from "../types";
import { buildImportWorkspace, suggestMappings } from "../lib/flightImport";
import { FlightImportModal } from "./FlightImportModal";

const aircraft = [
  {
    id: "a",
    tailNumber: "C-FXYZ",
    makeModel: "Test Aircraft",
    recordKind: "aircraft",
  },
] as Aircraft[];
const source = {
  filename: "fixture.csv",
  fileType: "csv" as const,
  detectedFormat: "generic" as const,
  headers: ["Date", "Aircraft", "From", "To", "Total Time"],
  rows: [
    {
      Date: "2026-08-01",
      Aircraft: "C-FXYZ",
      From: "CEN4",
      To: "CYBW",
      "Total Time": "1.0",
    },
  ],
};
const workspace = buildImportWorkspace(
  source,
  suggestMappings(source.headers),
  "iso",
  [],
  aircraft,
);
afterEach(cleanup);
function view(onClose = vi.fn(), onImport = vi.fn()) {
  return {
    onClose,
    onImport,
    ...render(
      <FlightImportModal
        initial={workspace}
        aircraft={aircraft}
        flights={[]}
        templates={[]}
        onSaveTemplate={vi.fn()}
        onClose={onClose}
        onImport={onImport}
      />,
    ),
  };
}
it("cancels without importing at mapping, review, and reconciliation stages", () => {
  let rendered = view();
  fireEvent.click(screen.getByRole("button", { name: "Cancel import" }));
  expect(rendered.onClose).toHaveBeenCalled();
  expect(rendered.onImport).not.toHaveBeenCalled();
  rendered.unmount();
  rendered = view();
  fireEvent.click(screen.getByRole("button", { name: "Review rows" }));
  fireEvent.click(screen.getByRole("button", { name: "Cancel import" }));
  expect(rendered.onImport).not.toHaveBeenCalled();
  rendered.unmount();
  rendered = view();
  fireEvent.click(screen.getByRole("button", { name: "Review rows" }));
  fireEvent.click(
    screen.getByRole("button", { name: /Reconcile 1 ready row/ }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Cancel import" }));
  expect(rendered.onImport).not.toHaveBeenCalled();
});
it("passes the staged workspace only after final confirmation", () => {
  const rendered = view();
  fireEvent.click(screen.getByRole("button", { name: "Review rows" }));
  fireEvent.click(
    screen.getByRole("button", { name: /Reconcile 1 ready row/ }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Confirm and import" }));
  expect(rendered.onImport).toHaveBeenCalledOnce();
});

it("marks manual row corrections and can restore the parsed source value", () => {
  view();
  fireEvent.click(screen.getByRole("button", { name: "Review rows" }));
  fireEvent.click(screen.getByText(/Row 2/));
  const route = screen.getByLabelText("Route") as HTMLInputElement;
  expect(route.value).toBe("");
  fireEvent.change(route, { target: { value: "VIA FIXTURE" } });
  expect(
    screen.getByRole("button", { name: "Restore parsed values" }),
  ).toBeTruthy();
  fireEvent.click(
    screen.getByRole("button", { name: "Restore parsed values" }),
  );
  expect(route.value).toBe("");
});
