import { Copy, Trash2 } from 'lucide-react';
import MiniField from './MiniField';

export default function FrameThumbnail({ frame, index, active, onClick, onDuplicate, onDelete, canDelete, orientation = 'horizontal' }) {
  return (
    <div className={`frame-thumb ${active ? 'frame-thumb--active' : ''}`}>
      <button className="frame-thumb__main" onClick={onClick}>
        <span className="frame-thumb__number">{index + 1}</span>
        <MiniField frame={frame} orientation={orientation} />
        <span className="frame-thumb__name">{frame.name || `第 ${index + 1} 页`}</span>
      </button>
      <div className="frame-thumb__actions">
        <button onClick={onDuplicate} aria-label="复制页面"><Copy size={14} /></button>
        <button onClick={onDelete} aria-label="删除页面" disabled={!canDelete}><Trash2 size={14} /></button>
      </div>
    </div>
  );
}
