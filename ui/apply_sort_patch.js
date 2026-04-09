const fs = require('fs');
const path = require('path');
const filePath = path.join('src', 'components', 'HeroTimeline.jsx');
let text = fs.readFileSync(filePath, 'utf8');
if (!text.includes('const timelineSortOptions')) {
  text = text.replace(
    '}\n\nconst formatDate',
    `}\n\nconst timelineSortOptions = [\n  { label: 'Newest first', value: 'desc' },\n  { label: 'Oldest first', value: 'asc' },\n]\n\nconst formatDate`
  );
}
text = text.replace(
  '  const backendBaseUrl = normalizeBaseUrl(import.meta.env.VITE_BACKEND_URL)\n',
  `  const backendBaseUrl = normalizeBaseUrl(import.meta.env.VITE_BACKEND_URL)\n  const [sortDirection, setSortDirection] = useState('desc')\n`
);
text = text.replace(
  `  const orderedEntries = useMemo(() => {\n    return [...entries].sort((a, b) => {\n      const aDate = new Date(a.issue_date ?? 0).getTime()\n      const bDate = new Date(b.issue_date ?? 0).getTime()\n      return aDate - bDate\n    })\n  }, [entries])`,
  `  const orderedEntries = useMemo(() => {\n    const direction = sortDirection === 'asc' ? 1 : -1\n    return [...entries].sort((a, b) => {\n      const aDate = new Date(a.issue_date ?? 0).getTime()\n      const bDate = new Date(b.issue_date ?? 0).getTime()\n      const safeADate = Number.isNaN(aDate) ? 0 : aDate\n      const safeBDate = Number.isNaN(bDate) ? 0 : bDate\n      if (safeADate === safeBDate) return 0\n      return direction * (safeADate - safeBDate)\n    })\n  }, [entries, sortDirection])`
);
text = text.replace(
  `      <div className="flex items-center justify-between">\n        <div>\n          <p className="title-xs">${'${heroName}'} timeline</p>\n          <p className="body-xs text-slate-500">Events sync from the IssueLine backend.</p>\n        </div>\n      </div>`,
  `      <div className="flex flex-wrap items-center justify-between gap-3">\n        <div>\n          <p className="title-xs">${'${heroName}'} timeline</p>\n          <p className="body-xs text-slate-500">Events sync from the IssueLine backend.</p>\n        </div>\n        <div className="flex items-center gap-2">\n          <span className="body-xs text-slate-500">Sort by date:</span>\n          <div className="inline-flex rounded-full border border-slate-200 bg-white p-0.5">\n            {timelineSortOptions.map((option) => {\n              const isActive = sortDirection === option.value\n              return (\n                <button\n                  key={option.value}\n                  type="button"\n                  aria-pressed={isActive}\n                  onClick={() => setSortDirection(option.value)}\n                  className={\`rounded-full px-3 py-1 body-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 ${'${'}\n                    isActive\n                      ? 'bg-slate-900 text-white shadow-sm'\n                      : 'text-slate-600 hover:text-slate-900'\n                  }\`}\n                >\n                  {option.label}\n                </button>\n              )\n            })}\n          </div>\n        </div>\n      </div>`
);
fs.writeFileSync(filePath, text);
