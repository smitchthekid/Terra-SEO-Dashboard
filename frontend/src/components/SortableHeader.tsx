import { ArrowUpDown, ChevronDown, ChevronUp } from 'lucide-react';

export type SortConfig = { key: string; dir: 'asc' | 'desc' };

export function SortableHeader({
  label, sortKey, current, onSort, align = 'left',
}: {
  label: string; sortKey: string; current: SortConfig; onSort: (key: string) => void; align?: 'left' | 'right';
}) {
  const isActive = current.key === sortKey;
  return (
    <th
      className={`px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer select-none hover:bg-gray-100 transition-colors ${align === 'right' ? 'text-right' : 'text-left'}`}
      onClick={() => onSort(sortKey)}
    >
      <span className={`inline-flex items-center gap-1 ${align === 'right' ? 'flex-row-reverse justify-start' : ''}`}>
        {label}
        {isActive ? (
          current.dir === 'asc' ? <ChevronUp className="w-3.5 h-3.5 text-indigo-600" /> : <ChevronDown className="w-3.5 h-3.5 text-indigo-600" />
        ) : (
          <ArrowUpDown className="w-3 h-3 text-gray-300" />
        )}
      </span>
    </th>
  );
}

/**
 * Toggle a SortConfig: clicking the active column flips its direction;
 * clicking a new column switches to that column, ascending.
 */
export function toggleSortConfig(prev: SortConfig, key: string): SortConfig {
  if (prev.key === key) {
    return { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' };
  }
  return { key, dir: 'asc' };
}

/**
 * Generic comparator-based sort helper. Accepts a map of sort-key -> value
 * extractor and returns a new sorted array (does not mutate the input).
 */
export function sortByConfig<T>(
  data: T[],
  config: SortConfig,
  extractors: Record<string, (row: T) => string | number | null>,
): T[] {
  const extractor = extractors[config.key];
  if (!extractor) return data;
  const sorted = [...data].sort((a, b) => {
    const av = extractor(a);
    const bv = extractor(b);
    if (av === null && bv === null) return 0;
    if (av === null) return 1;
    if (bv === null) return -1;
    if (typeof av === 'string' || typeof bv === 'string') {
      return String(av).localeCompare(String(bv));
    }
    return (av as number) - (bv as number);
  });
  if (config.dir === 'desc') sorted.reverse();
  return sorted;
}
