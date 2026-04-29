import { syncSeriesIssuesForHero } from "../src/modules/gcd/issueSyncService.js";
import { getHeroBySlug } from "../src/modules/hero/timelineService.js";

const HERO_SLUG = "doctor-strange";
const ISSUE_URLS = [
  'https://www.comics.org/api/issue/29379/',
  'https://www.comics.org/api/issue/50635/',
  'https://www.comics.org/api/issue/53021/'
];

const hero = await getHeroBySlug(HERO_SLUG);
if (!hero) {
  throw new Error(`Hero ${HERO_SLUG} not found`);
}

const result = await syncSeriesIssuesForHero({
  hero,
  seriesId: 999999,        // dummy id required by parser
  issueUrlsOverride: ISSUE_URLS,
  skipNewsstand: true,
});

console.log('Manual issue sync result:', result);
