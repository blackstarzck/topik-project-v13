import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";

const globalCss = readFileSync(
  join(process.cwd(), "src/styles/global.css"),
  "utf8",
);

test.describe("inline writing blanks", () => {
  test("align blank controls to the sentence text centerline", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 900, height: 300 });
    await page.setContent(`
      <!doctype html>
      <html>
        <head>
          <style>
            :root {
              --app-color-text-secondary: #667085;
              --app-color-border: #d0d5dd;
              --app-color-bg-container: #fff;
              --app-color-primary: #1677ff;
              --app-color-text: #101828;
            }
            ${globalCss}
          </style>
        </head>
        <body>
          <div class="writing-inline-prompt">
            <span data-probe="text">시간이 더 오래</span><button
              class="writing-inline-blank writing-inline-blank--active"
              type="button"
            ><span class="writing-inline-blank__index">1</span><span>ㄱ</span></button><span>
              보이지만 계속 반복하다 보면 나중에는 복습이 훨씬 쉬워진다.
            </span>
          </div>
        </body>
      </html>
    `);

    const centers = await page.evaluate(() => {
      const text = document.querySelector("[data-probe='text']");
      const blank = document.querySelector(".writing-inline-blank");
      if (!text || !blank) throw new Error("probe elements missing");
      const textRect = text.getBoundingClientRect();
      const blankRect = blank.getBoundingClientRect();
      return {
        textCenterY: textRect.top + textRect.height / 2,
        blankCenterY: blankRect.top + blankRect.height / 2,
      };
    });

    expect(
      Math.abs(centers.blankCenterY - centers.textCenterY),
    ).toBeLessThanOrEqual(1);
  });
});
