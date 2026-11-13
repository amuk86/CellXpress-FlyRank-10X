import { test, expect } from "@playwright/test";
import nextEnv from "@next/env";
const { loadEnvConfig } = nextEnv;
import { getDb } from "../../lib/firebaseAdmin.js";
loadEnvConfig(process.cwd());
test("staff sign-in, manual intake, lifecycle, PDF and logout", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (err) => errors.push(err.message));
  const customer = `Browser Fiction ${Date.now()}`;
  try {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login$/);
    await page.getByLabel("Staff email").fill("staff@cellxpress.example");
    await page.getByLabel("Password", { exact: true }).fill("DemoRepair!2026");
    await page.getByRole("button", { name: "Sign in →" }).click();
    await expect(
      page.getByRole("heading", { name: "Repair Operations Dashboard" }),
    ).toBeVisible();
    await page.getByRole("link", { name: "+ Create repair job" }).click();
    await page.getByLabel("Customer name", { exact: true }).fill(customer);
    await page
      .getByLabel("Device model", { exact: true })
      .fill("Browser Test Phone");
    await page.getByLabel("Fee (ZAR, leave blank if unknown)").fill("450");
    await page
      .getByLabel("Fault description", { exact: true })
      .fill("Cracked screen");
    await expect(
      page.getByRole("button", { name: "Save job to board" }),
    ).toBeDisabled();
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Save job to board" }).click();
    const ticket = page.getByRole("article").filter({ hasText: customer });
    await expect(ticket).toBeVisible();
    await ticket.getByRole("button", { name: "Mark ready" }).click();
    await expect(
      page.getByRole("alert").filter({ hasText: "Record work done" }),
    ).toBeVisible();
    await ticket.getByRole("button", { name: "Edit details" }).click();
    await ticket
      .getByLabel("Work done", { exact: true })
      .fill("Screen replaced and tested");
    await ticket.getByRole("button", { name: "Save details" }).click();
    await expect(
      ticket.getByRole("button", { name: "Save details" }),
    ).toHaveCount(0);
    await ticket.getByRole("button", { name: "Mark ready" }).click();
    await expect(
      ticket.getByRole("button", { name: "Mark collected" }),
    ).toBeDisabled();
    await ticket
      .getByLabel(`Payment for ${customer}`, { exact: true })
      .selectOption("paid");
    await expect(
      ticket.getByRole("button", { name: "Mark collected" }),
    ).toBeEnabled();
    const downloadPromise = page.waitForEvent("download");
    await ticket.getByRole("button", { name: "Download PDF" }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^CellXpress-.*\.pdf$/);
    await ticket.getByRole("button", { name: "Mark collected" }).click();
    await expect(ticket.getByText("Collected", { exact: true })).toBeVisible();
    await page.reload();
    await expect(
      page.getByRole("article").filter({ hasText: customer }),
    ).toBeVisible();
    await page.screenshot({
      path: "test-results/dashboard.png",
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(
      page.getByRole("heading", { name: "Repair Operations Dashboard" }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({ path: "test-results/mobile.png", fullPage: true });
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/login$/);
    expect(errors).toEqual([]);
  } finally {
    const docs = await getDb()
      .collection("jobs")
      .where("customerName", "==", customer)
      .get();
    const batch = getDb().batch();
    docs.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
});

test("AI drafts populate fields, preserve a free repair and require fresh review", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByLabel("Staff email").fill("staff@cellxpress.example");
  await page.getByLabel("Password", { exact: true }).fill("DemoRepair!2026");
  await page.getByRole("button", { name: "Sign in →" }).click();
  await expect(
    page.getByRole("heading", { name: "Repair Operations Dashboard" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "+ New job", exact: true }).click();
  await page.getByRole("checkbox").check();
  await page.route("**/api/extract", (route) =>
    route.fulfill({
      json: {
        customerName: "AI Demo",
        deviceModel: null,
        fee: 0,
        faultDescription: "Visible cracked screen",
        confidence: {
          customerName: 0.9,
          deviceModel: 0,
          fee: 0.8,
          faultDescription: 0.8,
        },
        warnings: ["Missing: deviceModel. Enter it manually."],
        usage: { model: "mock-model", estimatedCostUsd: null },
        reviewRequired: true,
      },
    }),
  );
  await page.locator("input[type=file]").setInputFiles({
    name: "fictional-device.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aY9sAAAAASUVORK5CYII=",
      "base64",
    ),
  });
  await page.getByRole("button", { name: "Extract job details" }).click();
  await expect(page.getByLabel("Customer name", { exact: true })).toHaveValue(
    "AI Demo",
  );
  await expect(page.getByLabel("Device model", { exact: true })).toHaveValue(
    "",
  );
  await expect(
    page.getByLabel("Fee (ZAR, leave blank if unknown)"),
  ).toHaveValue("0");
  await expect(
    page.getByText("Missing: deviceModel. Enter it manually."),
  ).toBeVisible();
  await expect(page.getByRole("checkbox")).not.toBeChecked();
  await expect(
    page.getByRole("button", { name: "Save job to board" }),
  ).toBeDisabled();
  await page.getByRole("checkbox").check();
  await page
    .getByLabel("Device model", { exact: true })
    .fill("Manually verified phone");
  await expect(page.getByRole("checkbox")).not.toBeChecked();
});
