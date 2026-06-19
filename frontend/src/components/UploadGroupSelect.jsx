export const GROUP_NEW = '__new__';

export function appendGroupFields(formData, { choice, newName, kind = 'production' }) {
  if (kind !== 'production') return;
  if (choice === GROUP_NEW && newName?.trim()) {
    formData.append('newGroupName', newName.trim());
  } else if (choice && choice !== GROUP_NEW) {
    formData.append('groupId', choice);
  }
}

export default function UploadGroupSelect({
  groups = [],
  value,
  newName,
  onChange,
  onNewNameChange,
  disabled = false,
  kind = 'production',
  label = 'Production group',
}) {
  if (kind !== 'production') {
    return null;
  }

  return (
    <div className="form-group">
      <label>{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      >
        <option value="">No group</option>
        {groups.map((group) => (
          <option key={group._id} value={group._id}>
            {group.name}
          </option>
        ))}
        <option value={GROUP_NEW}>+ Create new group…</option>
      </select>
      {value === GROUP_NEW && (
        <input
          type="text"
          value={newName}
          onChange={(e) => onNewNameChange(e.target.value)}
          placeholder="Enter new group name"
          required
          disabled={disabled}
          style={{ marginTop: '0.5rem' }}
        />
      )}
      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
        Assign uploaded clips to a production group for labellers. New names create a group if it does
        not exist yet.
      </p>
    </div>
  );
}
