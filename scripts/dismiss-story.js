// Existing regressions test the app after the separate first-visit story.
export async function dismissStory(page) {
  await page.locator('.ling-splash, .ling-story, .app-shell').first().waitFor()
  const splash = page.getByRole('button', { name: 'Tap anywhere to continue', exact: true })
  if (await page.locator('.ling-splash').isVisible()) await splash.click() // Wait for opening animation to finish.
  await page.locator('.ling-story, .app-shell').first().waitFor()
  const skip = page.getByRole('button', { name: 'Skip intro', exact: true })
  if (await skip.isVisible()) await skip.click()
}
