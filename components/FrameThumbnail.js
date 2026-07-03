/*
 * @Author: skye 3016218068@tju.edu.cn
 * @Date: 2026-07-01 14:47:01
 * @LastEditors: skye 3016218068@tju.edu.cn
 * @LastEditTime: 2026-07-02 17:21:02
 * @FilePath: /frisbee-tactics-board/components/FrameThumbnail.js
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
import { Copy, Trash2 } from 'lucide-react';
import MiniField from './MiniField';

export default function FrameThumbnail({ frame, index, active, onClick, onDuplicate, onDelete, canDelete, orientation = 'horizontal', readOnly = false }) {
  return (
    <div className={`frame-thumb ${active ? 'frame-thumb--active' : ''}`}>
      <button className="frame-thumb__main" onClick={onClick}>
        <span className="frame-thumb__number">{index + 1}</span>
        <MiniField frame={frame} orientation={orientation} />
        <span className="frame-thumb__name">{frame.name || `第 ${index + 1} 页`}</span>
      </button>
      {!readOnly && (
        <div className="frame-thumb__actions">
          <button onClick={onDuplicate} aria-label="复制页面"><Copy size={14} /></button>
          <button onClick={onDelete} aria-label="删除页面" disabled={!canDelete}><Trash2 size={14} /></button>
        </div>
      )}
    </div>
  );
}
