// The "Intro to REality (Recruiting)" email Am sends after a half-day event, word for word from her template.
// The hub builds it (escaped) so the preview on the REality page is exactly what the routine sends.

export const REALITY_FROM = 'Admin Client Care <Admin.ClientCare@clubwealth.com>';
export const REALITY_CC = ['mona@realestatestatistics.com', 'jessica@realestatestatistics.com'];
export const REALITY_SUBJECT = 'Intro to REality (Recruiting)';

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

const SIGNATURE_HTML = '<p><br>Make it a GREAT Day!<br><b><i>Am Marbella</i></b><br>amrissa.marbella@clubwealth.com<br><b>(253) 242-6028</b><br><i>"No SUCCESS in the WORLD can compensate for failure in the HOME"</i></p>';
const SIGNATURE_TEXT = 'Make it a GREAT Day!\nAm Marbella\namrissa.marbella@clubwealth.com\n(253) 242-6028\n"No SUCCESS in the WORLD can compensate for failure in the HOME"';

export function realityEmail(first: string, location: string) {
  const html = [
    `<p>Hi ${esc(first)},</p>`,
    `<p>This is Am with Club Wealth! I have you attended one of our recent Half-Day Events with Michael in ${esc(location)} and showed interest in REality's services.</p>`,
    "<p>I've looped in Mona on this email. She'll take great care of you and can assist with next steps.</p>",
    '<p>Looking forward to seeing how REality can support your business!</p>',
    '<p>Mona - mona@realestatestatistics.com</p>',
    SIGNATURE_HTML,
  ].join('\n');
  const text = [
    `Hi ${first},`,
    `This is Am with Club Wealth! I have you attended one of our recent Half-Day Events with Michael in ${location} and showed interest in REality's services.`,
    "I've looped in Mona on this email. She'll take great care of you and can assist with next steps.",
    'Looking forward to seeing how REality can support your business!',
    'Mona - mona@realestatestatistics.com',
    SIGNATURE_TEXT,
  ].join('\n\n');
  return { subject: REALITY_SUBJECT, html, text };
}
