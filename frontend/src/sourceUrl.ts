// Source links are rendered as <a href>, so only http(s) addresses are shown;
// the API rejects anything else, and this also covers data saved before that check.
export function isHttpUrl(value: string | null | undefined): value is string {
  return Boolean(value && /^https?:\/\/\S+$/i.test(value.trim()))
}
