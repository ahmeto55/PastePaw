import { ClipboardItem } from '../types';
import { clsx } from 'clsx';
import { useMemo, memo, useState, forwardRef } from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';
import { Copy, Check, FileText, Link2, Code2, Image as ImageIcon } from 'lucide-react';

interface ClipCardProps {
  clip: ClipboardItem;
  isSelected: boolean;
  layout?: { columnWidth: number; cardGap: number; cardVerticalPadding: number };
  onSelect: () => void;
  onPaste: () => void;
  onCopy: () => void;
  onDragStart: (clipId: string, startX: number, startY: number) => void;
  onContextMenu?: (e: React.MouseEvent) => void;
}

function formatTimeAgo(rawDate?: string | number): string {
  if (!rawDate) return 'Just now';
  const parsed = typeof rawDate === 'number' ? rawDate : Date.parse(rawDate);
  if (Number.isNaN(parsed)) return '';
  const diffSec = Math.max(1, Math.floor((Date.now() - parsed) / 1000));
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

export const ClipCard = memo(
  forwardRef<HTMLDivElement, ClipCardProps>(function ClipCard(
    {
      clip,
      isSelected,
      onSelect,
      onPaste,
      onCopy,
      onDragStart,
      onContextMenu,
    }: ClipCardProps,
    ref
  ) {
    const [copied, setCopied] = useState(false);
    const [imgError, setImgError] = useState(false);

    const imageSrc = useMemo(() => {
      if (clip.clip_type !== 'image') return null;
      const anyClip = clip as unknown as {
        thumbnail?: string;
        image_path?: string;
        file_path?: string;
      };
      const value = anyClip.thumbnail || anyClip.image_path || anyClip.file_path || clip.content;
      if (!value) return null;

      const isAbsolutePath = value.startsWith('/') || /^[A-Za-z]:[\\/]/.test(value);
      if (
        value.startsWith('data:') ||
        value.startsWith('http://') ||
        value.startsWith('https://') ||
        value.startsWith('asset:') ||
        value.startsWith('tauri://')
      ) {
        return value;
      }
      if (isAbsolutePath) {
        return convertFileSrc(value);
      }
      return `data:image/png;base64,${value}`;
    }, [clip]);

    const isUrl = useMemo(() => {
      if (clip.clip_type === 'image' || !clip.content) return false;
      const trimmed = clip.content.trim();
      return /^https?:\/\/\S+$/i.test(trimmed);
    }, [clip.clip_type, clip.content]);

    const isCode = useMemo(() => {
      if (clip.clip_type === 'image' || isUrl || !clip.content) return false;
      return /[{};()=>]|const |function |import |def |class |cmd |pnpm |npm /.test(clip.content);
    }, [clip.clip_type, clip.content, isUrl]);

    const timeAgo = useMemo(() => {
      const anyClip = clip as unknown as { created_at?: string | number; updated_at?: string | number };
      return formatTimeAgo(anyClip.created_at ?? anyClip.updated_at);
    }, [clip]);

    const handleMouseDown = (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      onDragStart(clip.id, e.clientX, e.clientY);
    };

    const formattedText = useMemo(() => {
      if (clip.clip_type === 'image' || !clip.content) return '';
      return clip.content
        .replace(/\r\n/g, '\n')
        .split('\n')
        .map((line) => line.trimEnd())
        .filter((line, idx, arr) => !(line === '' && arr[idx - 1] === ''))
        .join('\n')
        .trim();
    }, [clip.clip_type, clip.content]);

    if (clip.clip_type === 'image') {
      return (
        <div
          ref={ref}
          data-el="clip-card"
          data-clip-id={clip.id}
          onMouseDown={handleMouseDown}
          onClick={onSelect}
          onDoubleClick={onPaste}
          onContextMenu={(e) => {
            e.preventDefault();
            onContextMenu?.(e);
          }}
          className={clsx(
            'group relative flex w-full flex-shrink-0 cursor-pointer select-none flex-col overflow-hidden rounded-2xl border shadow-none backdrop-blur-xl transition-colors duration-150',
            isSelected
              ? 'border-[#1434A4] bg-[#1434A4]/20'
              : 'border-white/10 bg-white/[0.05] hover:border-[#1434A4]/70 hover:bg-white/[0.09]'
          )}
        >
          <div className="relative flex min-h-[100px] w-full items-center justify-center overflow-hidden bg-black/25 p-2">
            {imageSrc && !imgError ? (
              <img
                src={imageSrc}
                alt="Clipboard preview"
                onError={() => setImgError(true)}
                className="max-h-96 w-full rounded-lg object-contain"
              />
            ) : (
              <div className="flex flex-col items-center gap-1.5 py-6 text-[#4d79ff]">
                <ImageIcon size={26} />
                <span className="text-[11px] font-medium text-white/75">Image Preview</span>
              </div>
            )}

            <button
              data-el="clip-card-copy-btn"
              onClick={(e) => {
                e.stopPropagation();
                onCopy();
                setCopied(true);
                setTimeout(() => setCopied(false), 1800);
              }}
              className="absolute right-2.5 top-2.5 z-20 rounded-xl border border-white/15 bg-black/60 p-1.5 opacity-0 backdrop-blur-md transition-opacity hover:border-[#1434A4] hover:bg-[#1434A4] group-hover:opacity-100"
              title="Copy image"
            >
              {copied ? (
                <Check size={14} className="text-white" />
              ) : (
                <Copy size={14} className="text-white/90" />
              )}
            </button>
          </div>

          <div className="flex items-center justify-between gap-2 border-t border-white/10 bg-white/[0.03] px-3.5 py-2 text-[11px] text-muted-foreground">
            <div className="flex min-w-0 items-center gap-1.5">
              {clip.source_icon ? (
                <img
                  src={`data:image/png;base64,${clip.source_icon}`}
                  alt=""
                  className="h-3.5 w-3.5 flex-shrink-0 object-contain"
                />
              ) : (
                <ImageIcon size={13} className="flex-shrink-0 text-[#4d79ff]" />
              )}
              <span className="truncate font-medium text-foreground/85">
                {clip.source_app || 'Image'}
              </span>
            </div>
            {timeAgo && <span className="flex-shrink-0 opacity-75">{timeAgo}</span>}
          </div>
        </div>
      );
    }

    return (
      <div
        ref={ref}
        data-el="clip-card"
        data-clip-id={clip.id}
        onMouseDown={handleMouseDown}
        onClick={onSelect}
        onDoubleClick={onPaste}
        onContextMenu={(e) => {
          e.preventDefault();
          onContextMenu?.(e);
        }}
        className={clsx(
          'group relative flex w-full flex-shrink-0 cursor-pointer select-none items-start gap-3 overflow-hidden rounded-2xl border p-3.5 shadow-none backdrop-blur-xl transition-colors duration-150',
          isSelected
            ? 'border-[#1434A4] bg-[#1434A4]/20'
            : 'border-white/10 bg-white/[0.05] hover:border-[#1434A4]/70 hover:bg-white/[0.09]'
        )}
      >
        <div className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border border-[#1434A4]/70 bg-[#1434A4]/30">
          {isUrl ? (
            <Link2 size={17} className="text-[#4d79ff]" />
          ) : isCode ? (
            <Code2 size={17} className="text-[#4d79ff]" />
          ) : (
            <FileText size={17} className="text-[#4d79ff]" />
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <p
            className={clsx(
              'line-clamp-5 whitespace-pre-wrap break-words text-[12.5px] leading-relaxed text-foreground/95',
              isCode && 'rounded-lg bg-black/20 px-2.5 py-1.5 font-mono text-[11.5px] text-white/90'
            )}
          >
            {formattedText || 'Empty clip'}
          </p>

          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            {clip.source_icon && (
              <img
                src={`data:image/png;base64,${clip.source_icon}`}
                alt=""
                className="h-3.5 w-3.5 flex-shrink-0 object-contain"
              />
            )}
            <span className="truncate font-medium">
              {clip.source_app || clip.clip_type.toUpperCase()}
            </span>
            {timeAgo && (
              <>
                <span className="opacity-40">•</span>
                <span className="flex-shrink-0 opacity-75">{timeAgo}</span>
              </>
            )}
          </div>
        </div>

        <button
          data-el="clip-card-copy-btn"
          onClick={(e) => {
            e.stopPropagation();
            onCopy();
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
          }}
          className="flex-shrink-0 rounded-lg border border-white/10 bg-white/10 p-1.5 opacity-0 transition-opacity hover:border-[#1434A4] hover:bg-[#1434A4] group-hover:opacity-100"
          title="Copy to clipboard"
        >
          {copied ? (
            <Check size={14} className="text-white" />
          ) : (
            <Copy size={14} className="text-foreground/80" />
          )}
        </button>
      </div>
    );
  })
);
