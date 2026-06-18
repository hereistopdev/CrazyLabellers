import { useEffect, useMemo, useState } from 'react';
import { matchesSearch, paginateItems, totalPages } from '../utils/tableFilter';

export function useTableData(items, options = {}) {
  const {
    searchKeys = ['title'],
    pageSize: initialPageSize = 25,
    filterFn,
    sortFn,
    initialFilters = {},
  } = options;

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [filters, setFilters] = useState(initialFilters);

  const updateFilter = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const filtered = useMemo(() => {
    let result = [...(items || [])];

    if (search.trim()) {
      result = result.filter((item) => matchesSearch(item, search, searchKeys));
    }

    if (filterFn) {
      result = filterFn(result, filters);
    }

    if (sortFn) {
      result = sortFn(result, filters);
    }

    return result;
  }, [items, search, searchKeys, filterFn, sortFn, filters]);

  const paginated = useMemo(
    () => paginateItems(filtered, page, pageSize),
    [filtered, page, pageSize]
  );

  const pages = totalPages(filtered.length, pageSize);

  useEffect(() => {
    setPage(1);
  }, [search, filters, pageSize, items?.length]);

  useEffect(() => {
    if (page > pages) {
      setPage(pages);
    }
  }, [page, pages]);

  return {
    search,
    setSearch,
    filters,
    setFilters,
    updateFilter,
    page,
    setPage,
    pageSize,
    setPageSize,
    filtered,
    paginated,
    totalCount: filtered.length,
    totalPages: pages,
  };
}
