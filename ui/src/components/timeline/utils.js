export const hasSpecialIssueCode = (entry) => {
  const code =
    entry?.issue_code ??
    entry?.metadata?.issue_code ??
    entry?.metadata?.issueCode ??
    ''
  return typeof code === 'string' && code.toLowerCase().includes('special')
}
