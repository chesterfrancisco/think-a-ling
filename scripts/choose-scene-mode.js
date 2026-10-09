export async function chooseSceneMode(page, mode) {
  const button = page.locator('.intent-choices button[data-mode=' + mode + ']')
  if (!await button.isVisible()) await page.locator('.other-modes > summary').click()
  await button.click()
}
