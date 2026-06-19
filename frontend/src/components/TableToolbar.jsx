export default function TableToolbar({
  search,
  onSearchChange,
  searchPlaceholder = 'Search…',
  totalCount,
  filteredCount,
  children,
}) {
  const showing = filteredCount ?? totalCount ?? 0;
  const total = totalCount ?? showing;

  return (
    <div className="table-toolbar">
      <div className="table-toolbar-row">
        <label className="table-search">
          <span className="sr-only">Search</span>
          <input
            type="search"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
          />
        </label>
        {children ? <div className="table-toolbar-filters">{children}</div> : null}
        <div className="table-toolbar-meta">
          Showing {showing} of {total}
        </div>
      </div>
    </div>
  );
}
