import { expect, test } from '@playwright/test'

test('renders the main mobile-first flow', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('demo-login').click()

  await expect(page.getByTestId('active-vehicle-name')).toBeVisible()
  await expect(page.getByTestId('add-service-button')).toBeVisible()
  await expect(page.getByTestId('plan-service-button')).toBeVisible()

  await page.getByTestId('tab-plan').click()
  await expect(page.getByTestId('tab-plan')).toHaveAttribute('aria-pressed', 'true')
})