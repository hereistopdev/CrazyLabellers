export default function VideoWorkspaceAside({ children, className = '' }) {
  return (
    <aside className={`video-workspace-aside${className ? ` ${className}` : ''}`}>
      <div className="video-workspace-aside-inner">{children}</div>
    </aside>
  );
}
