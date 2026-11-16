import { FolderItem } from '../types';
import { Search, Plus, MoreHorizontal, X, ArrowUpCircle } from 'lucide-react';
import { clsx } from 'clsx';
import { useTranslation } from 'react-i18next';

interface ControlBarProps {
  folders: FolderItem[];
  selectedFolder: string | null;
  onSelectFolder: (folderId: string | null) => void;
  onSearchClick: () => void;
  onAddClick: () => void;
  onMoreClick: () => void;
  showSearch: boolean;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onMoveClip: (clipId: string, folderId: string | null) => void;
  isDragging: boolean;
  dragTargetFolderId: string | null;
  onDragHover: (folderId: string | null) => void;
  onDragLeave: () => void;
  totalClipCount: number;
  onFolderContextMenu?: (e: React.MouseEvent, folderId: string) => void;
  theme?: 'light' | 'dark';
  style?: React.CSSProperties;
  updateAvailable?: import('../hooks/useAutoUpdater').UpdateInfo | null;
}

export function ControlBar({
  folders,
  selectedFolder,
  onSelectFolder,
  onAddClick,
  onMoreClick,
  searchQuery,
  onSearchChange,
  isDragging,
  dragTargetFolderId,
  onDragHover,
  onDragLeave,
  totalClipCount,
  onFolderContextMenu,
  theme = 'dark',
  updateAvailable,
}: ControlBarProps) {
  const { t } = useTranslation();

  const allCategories = [
    { id: null, name: t('folders.all'), count: totalClipCount },
    ...folders.map((f) => ({ ...f, count: f.item_count })),
  ];

  const getPillStyle = (isActive: boolean, isAll: boolean) => {
    if (isAll) {
      return isActive
        ? 'bg-[#1434A4] text-white border-[#3b66f5]/80 shadow-[0_0_14px_rgba(20,52,164,0.5)] font-semibold'
        : 'bg-white/10 text-white/80 border-white/15 hover:bg-[#1434A4]/30 hover:border-[#1434A4] hover:text-white';
    }

    return isActive
      ? 'bg-[#1434A4] text-white border-[#3b66f5]/80 shadow-[0_0_14px_rgba(20,52,164,0.5)] font-semibold'
      : 'bg-[#1434A4]/20 text-white/80 border-[#1434A4]/50 hover:bg-[#1434A4]/40 hover:text-white';
  };

  return (
    <div
      data-el="control-bar"
      className="drag-area flex flex-shrink-0 flex-col gap-2.5 border-b border-white/10 px-3.5 pb-3 pt-3.5"
    >
      {/* Top Row: Frosted Search Bar + Action Buttons */}
      <div className="no-drag flex items-center gap-2">
        <div
          data-el="search-input-wrapper"
          className={clsx(
            'flex flex-1 items-center gap-2 rounded-xl border px-3 py-1.5 backdrop-blur-md transition-all',
            theme === 'light'
              ? 'border-black/10 bg-black/5 focus-within:border-[#1434A4] focus-within:bg-white/70'
              : 'border-white/15 bg-white/[0.07] focus-within:border-[#1434A4] focus-within:bg-[#1434A4]/15'
          )}
        >
          <Search size={15} className="flex-shrink-0 text-[#4d79ff]" />
          <input
            data-el="search-input"
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={t('common.search') || 'Search clips...'}
            className="w-full border-none bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground/70"
            onKeyDown={(e) => {
              if (e.key === 'Escape' && searchQuery) {
                e.preventDefault();
                e.stopPropagation();
                onSearchChange('');
              }
            }}
          />
          {searchQuery && (
            <button
              data-el="search-close-btn"
              onClick={() => onSearchChange('')}
              className="rounded-full p-0.5 text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground"
            >
              <X size={13} />
            </button>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-shrink-0 items-center gap-1">
          <button
            data-el="add-folder-btn"
            onClick={onAddClick}
            className="rounded-xl border border-white/10 bg-white/[0.06] p-1.5 text-muted-foreground transition-colors hover:border-[#1434A4] hover:bg-[#1434A4]/30 hover:text-white"
            title={t('folders.add')}
          >
            <Plus size={16} />
          </button>
          {updateAvailable && (
            <button
              onClick={onMoreClick}
              className="relative rounded-xl border border-white/10 bg-white/[0.06] p-1.5 text-muted-foreground transition-colors hover:border-[#1434A4] hover:bg-[#1434A4]/30 hover:text-white"
              title={t('settings.updateAvailable', { version: updateAvailable.version })}
            >
              <div className="absolute right-1 top-1 h-1.5 w-1.5 animate-pulse rounded-full bg-[#1434A4]" />
              <ArrowUpCircle size={16} />
            </button>
          )}
          <button
            data-el="settings-btn"
            onClick={onMoreClick}
            className="rounded-xl border border-white/10 bg-white/[0.06] p-1.5 text-muted-foreground transition-colors hover:border-[#1434A4] hover:bg-[#1434A4]/30 hover:text-white"
            title="Settings"
          >
            <MoreHorizontal size={16} />
          </button>
        </div>
      </div>

      {/* Wrapped Pill Tabs */}
      <div
        data-el="folder-pills"
        className="no-drag flex flex-wrap items-center gap-1.5"
      >
        {allCategories.map((cat) => {
          const isActive = selectedFolder === cat.id;
          const isDropTarget = isDragging && cat.id === dragTargetFolderId;

          return (
            <button
              key={cat.id ?? 'all'}
              data-el="folder-pill"
              data-folder-id={cat.id ?? 'all'}
              onClick={() => onSelectFolder(cat.id)}
              onMouseEnter={() => {
                if (isDragging) onDragHover(cat.id);
              }}
              onMouseLeave={onDragLeave}
              onContextMenu={(e) => {
                if (onFolderContextMenu && cat.id) {
                  onFolderContextMenu(e, cat.id);
                }
              }}
              className={clsx(
                'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium backdrop-blur-md transition-all',
                theme === 'light' && cat.id === null
                  ? isActive
                    ? 'border-[#1434A4] bg-[#1434A4] font-semibold text-white'
                    : 'border-black/10 bg-black/5 text-slate-700 hover:bg-black/10'
                  : getPillStyle(isActive, cat.id === null),
                isDropTarget && 'scale-105 ring-2 ring-[#1434A4]'
              )}
            >
              <span>{cat.name}</span>
              {cat.count !== undefined && cat.count > 0 && (
                <span className="rounded-full bg-black/25 px-1.5 py-0.5 text-[9px] opacity-90">
                  {cat.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
