export function getNestedValue(obj, path) {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

export function matchesSearch(item, query, keys = []) {
  if (!query?.trim()) return true;
  const q = query.trim().toLowerCase();
  return keys.some((key) => {
    const value = getNestedValue(item, key);
    return value != null && String(value).toLowerCase().includes(q);
  });
}

export function matchesDateRange(isoDate, from, to) {
  if (!isoDate) return true;
  const time = new Date(isoDate).getTime();
  if (Number.isNaN(time)) return true;
  if (from) {
    const fromTime = new Date(from).setHours(0, 0, 0, 0);
    if (time < fromTime) return false;
  }
  if (to) {
    const toTime = new Date(to).setHours(23, 59, 59, 999);
    if (time > toTime) return false;
  }
  return true;
}

export function paginateItems(items, page, pageSize) {
  const safePage = Math.max(1, page);
  const safeSize = Math.max(1, pageSize);
  const start = (safePage - 1) * safeSize;
  return items.slice(start, start + safeSize);
}

export function totalPages(count, pageSize) {
  return Math.max(1, Math.ceil(count / Math.max(1, pageSize)));
}

export function groupProductionTasks(tasks) {
  const map = new Map();
  tasks.forEach((task) => {
    const group = task.groupId;
    const key = group?._id || group || 'ungrouped';
    if (!map.has(key)) {
      map.set(key, {
        id: key,
        name: group?.name || 'Ungrouped',
        description: group?.description || '',
        sortOrder: group?.sortOrder ?? 9999,
        tasks: [],
      });
    }
    map.get(key).tasks.push(task);
  });
  return [...map.values()].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)
  );
}
