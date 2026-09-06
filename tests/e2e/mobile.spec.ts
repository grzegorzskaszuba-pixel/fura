import { expect, test } from '@playwright/test'

test('renders the main mobile-first flow', async ({ page }) => {
  await page.goto('/')

  const uniqueUser = `e2e_${Date.now()}`
  await page.getByRole('button', { name: 'Rejestracja' }).click()
  await page.getByLabel('Nazwa użytkownika').fill(uniqueUser)
  await page.getByLabel('Hasło').fill('haslo123')
  await page.getByRole('button', { name: 'Utwórz profil' }).click()

  await expect(page.getByText('Brak aut w profilu')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Dodaj auto' })).toBeVisible()
  await expect(page.getByTestId('add-service-button')).toBeVisible()
  await expect(page.getByTestId('plan-service-button')).toBeVisible()
})