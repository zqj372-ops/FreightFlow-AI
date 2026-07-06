export type EmailAttachment = {
  contentType?: string | null;
  fileName: string;
  size?: number | null;
};

const SO_NAME_PATTERN = /(?:^|[\s._-])(SO|S\/O|shipping\s*order|booking|confirmation)(?=$|[\s._-])/i;
const SO_EXT_PATTERN = /\.(pdf|png|jpe?g|webp|xlsx?|docx?)$/i;

export function isLikelySoAttachment(attachment: EmailAttachment) {
  const fileName = attachment.fileName.trim();
  const contentType = attachment.contentType?.toLowerCase() ?? "";

  if (!fileName) return false;
  if (SO_NAME_PATTERN.test(fileName) && SO_EXT_PATTERN.test(fileName)) return true;
  if (SO_NAME_PATTERN.test(fileName) && /pdf|image|spreadsheet|word|excel/.test(contentType)) return true;

  return false;
}

export function findSoAttachments(attachments: EmailAttachment[]) {
  return attachments.filter(isLikelySoAttachment);
}
