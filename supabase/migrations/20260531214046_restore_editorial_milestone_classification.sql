-- Preserve the legacy editorial-event classification for rows that were
-- deliberately anchored to a canonical issue for cover and source context.
update public.hero_timelines
set event_type = 'milestone'
where event_type <> 'milestone'
  and not (
    lower(coalesce(metadata ->> 'issue_category', metadata ->> 'issueCategory', '')) = 'annual'
    or lower(coalesce(metadata ->> 'special_issue_type', metadata ->> 'specialIssueType', '')) = 'annual'
    or lower(
      concat_ws(
        ' ',
        issue_code,
        metadata ->> 'issue_code',
        metadata ->> 'issueCode',
        metadata ->> 'issueLabel',
        metadata ->> 'issue_label'
      )
    ) like '%annual%'
  )
  and (
    lower(coalesce(metadata ->> 'issue_category', metadata ->> 'issueCategory', '')) = 'special'
    or lower(coalesce(metadata ->> 'special_issue_type', metadata ->> 'specialIssueType', '')) = 'special'
    or special_issue is true
    or lower(coalesce(metadata ->> 'special_issue', metadata ->> 'specialIssue', 'false')) = 'true'
    or lower(
      concat_ws(
        ' ',
        issue_code,
        metadata ->> 'issue_code',
        metadata ->> 'issueCode',
        metadata ->> 'issueLabel',
        metadata ->> 'issue_label'
      )
    ) like '%special%'
  );
