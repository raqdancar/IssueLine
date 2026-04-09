import { gcdGet } from './src/modules/gcd/client.js';

const data = await gcdGet('series/3645/');
console.log('Series:', data.name);
console.log('Total issues:', data.active_issues?.length ?? 0);
console.log('\nFirst 20 issue descriptors:');
data.issue_descriptors?.slice(0, 20).forEach((desc, i) => {
  console.log((i+1).toString().padStart(2), ':', desc);
});

console.log('\nIssues with [Direct]:');
data.issue_descriptors?.filter(d => /\[direct\]/i.test(d)).forEach((desc, i) => {
  console.log('  -', desc);
});

console.log('\nIssues with [Newsstand]:');
data.issue_descriptors?.filter(d => /newsstand/i.test(d)).forEach((desc, i) => {
  console.log('  -', desc);
});
