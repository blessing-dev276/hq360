/** Every field is encoded independently so text cannot inject mail headers. */
export function authorMailto(recipient: string, subject: string, body: string) {
  return `mailto:${encodeURIComponent(recipient)}?subject=${encodeURIComponent(subject.replace(/[\r\n]/g, " "))}&body=${encodeURIComponent(body)}`;
}
