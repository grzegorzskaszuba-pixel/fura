import { sendTestEmail } from './email-service.mjs'

const recipient = process.argv[2]?.trim()

if (!recipient) {
  console.error('[email-test] Usage: npm run email:test -- <recipient>')
  process.exitCode = 1
} else {
  try {
    const result = await sendTestEmail(recipient)
    const messageId = result?.id ? ` (id: ${result.id})` : ''
    console.log(`[email-test] sent to ${recipient}${messageId}`)
  } catch (error) {
    console.error(`[email-test] ${error instanceof Error ? error.message : String(error)}`)
    process.exitCode = 1
  }
}