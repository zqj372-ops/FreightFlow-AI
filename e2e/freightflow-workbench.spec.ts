import { expect, test } from "@playwright/test";
import { writeFile } from "node:fs/promises";

test("workbench modules support SO upload OCR and email sync", async ({ page }, testInfo) => {
  await page.goto("/");

  await expect(page.getByText("订舱工作台").first()).toBeVisible();
  await expect(page.getByText("FF-CA-240610-A01").first()).toBeVisible();

  await page.getByRole("button", { name: /SO识别中心/ }).click();
  await expect(page.getByRole("heading", { name: "SO 识别中心" })).toBeVisible();
  await expect(page.getByText("上传 SO / 放舱附件")).toBeVisible();

  const fixturePath = testInfo.outputPath("so-release.txt");
  await writeFile(fixturePath, "SO released. SO: OOLU8791320. Container: TEMU9088771. 40HQ.");
  await page.locator('input[type="file"]').setInputFiles(fixturePath);
  await expect(page.getByText(/附件已保存/)).toBeVisible();

  await page.getByRole("button", { name: /邮件中心/ }).click();
  await expect(page.getByRole("heading", { level: 2, name: "邮件中心" })).toBeVisible();
  await page.getByRole("button", { name: /同步邮箱/ }).click();
  await expect(page.getByText(/邮箱同步完成/)).toBeVisible();
});
