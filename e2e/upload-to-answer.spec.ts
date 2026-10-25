import { expect, test } from '@playwright/test';

test('uploads a text document, asks a question, and receives a cited answer', async ({ page }) => {
  let capturedRequest: Record<string, unknown> | undefined;
  await page.route('**/api/chat', async (route) => {
    capturedRequest = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({
      status: 200,
      contentType: 'text/plain; charset=utf-8',
      body: 'The policy deadline is June 30. [policy.txt, Page 1](#source-policy.txt)',
    });
  });

  await page.goto('/');
  await page.waitForLoadState('networkidle');
  const fileInput = page.getByLabel('Choose PDF or plain text files');
  await fileInput.setInputFiles({
    name: 'policy.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('The policy deadline is June 30.'),
  });
  // Ensure the app has hydrated before the browser dispatches the file input event.
  await fileInput.dispatchEvent('change');
  await expect(page.getByText('policy.txt', { exact: true })).toBeVisible();
  await page.getByRole('checkbox', { name: 'Use policy.txt as a source' }).check();
  await page.getByRole('textbox', { name: 'Ask your documents a question' }).fill('What is the policy deadline?');
  await page.getByRole('button', { name: 'Send message' }).click();

  await expect(page.getByText('The policy deadline is June 30.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'policy.txt, Page 1' })).toBeVisible();
  expect(capturedRequest).toMatchObject({
    question: 'What is the policy deadline?',
    documentsSelected: true,
    documentMetadata: [],
  });
  expect(capturedRequest?.excerpts).toEqual([
    { name: 'policy.txt', location: 'Paragraph 1', text: 'The policy deadline is June 30.' },
  ]);
});
