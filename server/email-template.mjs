const BRAND_ORANGE = '#f97316'
const BRAND_BLACK = '#09090b'
const BORDER = '#e4e4e7'
const MUTED_TEXT = '#52525b'
const PAGE_BACKGROUND = '#f6f7f8'
const FOOTER_TEXT = 'Simple service log for every car.'

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

export function renderFuraEmailParagraph(text) {
  return `<p style="margin:0 0 16px;color:${MUTED_TEXT};font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.6;">${escapeHtml(text)}</p>`
}

export function renderFuraEmailNote(text) {
  return `<p style="margin:24px 0 0;padding:14px 16px;border:1px solid #fed7aa;border-radius:14px;background:#fff7ed;color:#9a3412;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;">${escapeHtml(text)}</p>`
}

export function renderFuraEmailTemplate({ preheader = '', title, intro, contentHtml = '', action = null }) {
  const actionHtml = action
    ? `
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin:28px 0 8px;">
        <tr>
          <td align="center" bgcolor="${BRAND_ORANGE}" style="border-radius:14px;background:${BRAND_ORANGE};">
            <a href="${escapeHtml(action.url)}" style="display:inline-block;padding:15px 24px;border:1px solid ${BRAND_ORANGE};border-radius:14px;color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:700;line-height:1;text-decoration:none;">${escapeHtml(action.label)}</a>
          </td>
        </tr>
      </table>`
    : ''

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>${escapeHtml(title)}</title>
  </head>
  <body style="margin:0;padding:0;background:${PAGE_BACKGROUND};">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(preheader)}</div>
    <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="width:100%;background:${PAGE_BACKGROUND};">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#ffffff;border:1px solid ${BORDER};border-radius:24px;">
            <tr>
              <td style="padding:32px 32px 28px;">
                <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding:7px 18px;border:1px solid ${BORDER};border-radius:999px;background:#ffffff;">
                      <span style="display:inline-block;padding:8px 20px;border-radius:999px;background:${BRAND_BLACK};color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:24px;font-weight:700;letter-spacing:-1px;line-height:1;">FURA</span>
                    </td>
                  </tr>
                </table>
                <div style="height:32px;line-height:32px;">&nbsp;</div>
                <h1 style="margin:0 0 12px;color:${BRAND_BLACK};font-family:Arial,Helvetica,sans-serif;font-size:28px;font-weight:700;letter-spacing:-0.5px;line-height:1.2;">${escapeHtml(title)}</h1>
                ${renderFuraEmailParagraph(intro)}
                ${contentHtml}
                ${actionHtml}
                <div style="height:28px;line-height:28px;">&nbsp;</div>
                <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="border-top:1px solid ${BORDER};">
                  <tr>
                    <td style="padding-top:20px;color:${MUTED_TEXT};font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.5;">${FOOTER_TEXT}</td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

export function renderFuraEmailText({ title, intro, bodyText = '', action = null }) {
  const actionText = action ? `\n\n${action.label}: ${action.url}` : ''
  const body = bodyText ? `\n\n${bodyText}` : ''
  return `FURA\n\n${title}\n\n${intro}${body}${actionText}\n\nFURA\n${FOOTER_TEXT}`
}