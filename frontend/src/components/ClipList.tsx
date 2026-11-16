import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { convertFileSrc, invoke } from '@tauri-apps/api/core';
import { X, Copy, Check, ZoomIn, ZoomOut, FileText, Code2 } from 'lucide-react';
import { ClipboardItem } from '../types';
import { ClipCard } from './ClipCard';

interface ClipListProps {
  clips: ClipboardItem[];
  isLoading: boolean;
  hasMore: boolean;
  resetToken: number;
  selectedClipId: string | null;
  cardSize?: 'large' | 'medium';
  onSelectClip: (clipId: string) => void;
  onPaste: (clipId: string) => void;
  onCopy: (clipId: string) => void;
  onDelete: (clipId: string) => void;
  onLoadMore: () => void;
  onDragStart: (clipId: string, startX: number, startY: number) => void;
  onCardContextMenu?: (e: React.MouseEvent, clipId: string) => void;
}

function resolveFullImageSrc(clip: ClipboardItem | null): string | null {
  if (!clip || clip.clip_type !== 'image') return null;
  const anyClip = clip as unknown as {
    image_path?: string;
    file_path?: string;
    thumbnail?: string;
  };
  const value = clip.content || anyClip.image_path || anyClip.file_path || anyClip.thumbnail;
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
}

function renderInlineFormatting(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return (
        <strong key={idx} className="font-semibold text-white">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return (
        <code
          key={idx}
          className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[12px] text-sky-200"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return <span key={idx}>{part}</span>;
  });
}

function FormattedNoteView({ content }: { content: string }) {
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  let foundMainTitle = false;
  let underSectionHeading = false;

  return (
    <div className="select-text space-y-2.5 font-sans text-[15px] leading-relaxed text-white/90">
      {lines.map((rawLine, index) => {
        const trimmed = rawLine.trim();

        if (!trimmed) {
          return <div key={index} className="h-2.5" />;
        }

        const mdHeading = trimmed.match(/^(#{1,3})\s+(.+)$/);
        if (mdHeading) {
          const level = mdHeading[1].length;
          foundMainTitle = true;
          underSectionHeading = true;
          if (level === 1) {
            return (
              <h1
                key={index}
                className="mb-2 inline-block border-b-2 border-white/85 pb-1 text-2xl font-bold tracking-tight text-white"
              >
                {mdHeading}
              </h1>
            );
          }
          return (
            <div key={index} className="pt-3">
              <h2 className="inline-block border-b border-white/65 pb-0.5 text-lg font-medium text-white">
                {mdHeading}
              </h2>
            </div>
          );
        }

        const bulletMatch = trimmed.match(/^[-*•▪◦]\s+(.+)$/);
        if (bulletMatch) {
          return (
            <div key={index} className="flex items-start gap-3 pl-4">
              <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-white/80" />
              <p className="flex-1 text-[14.5px] leading-relaxed text-white/90">
                {renderInlineFormatting(bulletMatch[1])}
              </p>
            </div>
          );
        }

        const numMatch = trimmed.match(/^(\d+[.)])\s+(.+)$/);
        if (numMatch) {
          return (
            <div key={index} className="flex items-start gap-2.5 pl-3">
              <span className="min-w-[1.25rem] flex-shrink-0 font-medium text-white/65">
                {numMatch}
              </span>
              <p className="flex-1 text-[14.5px] leading-relaxed text-white/90">
                {renderInlineFormatting(numMatch[2])}
              </p>
            </div>
          );
        }

        const isShortStandalone =
          trimmed.length <= 42 &&
          !/[.!?,:;]$/.test(trimmed) &&
          !trimmed.includes('http');

        const prevEmpty = index === 0 || lines[index - 1].trim() === '';
        const nextLine = index + 1 < lines.length ? lines[index + 1].trim() : '';

        if (isShortStandalone && !foundMainTitle && index <= 1) {
          foundMainTitle = true;
          underSectionHeading = false;
          return (
            <div key={index} className="pb-1">
              <h1 className="inline-block border-b-2 border-white/85 pb-1 text-2xl font-bold tracking-tight text-white">
                {trimmed}
              </h1>
            </div>
          );
        }

        if (isShortStandalone && foundMainTitle && (prevEmpty || nextLine.length > 0)) {
          underSectionHeading = true;
          return (
            <div key={index} className="pt-3.5">
              <h2 className="inline-block border-b border-white/65 pb-0.5 text-lg font-medium text-white">
                {trimmed}
              </h2>
            </div>
          );
        }

        if (underSectionHeading) {
          return (
            <div key={index} className="flex items-start gap-3 pl-4">
              <span className="mt-2.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-white/75" />
              <p className="flex-1 text-[14.5px] leading-relaxed text-white/90">
                {renderInlineFormatting(trimmed)}
              </p>
            </div>
          );
        }

        return (
          <p key={index} className="text-[14.5px] leading-7 text-white/90">
            {renderInlineFormatting(trimmed)}
          </p>
        );
      })}
    </div>
  );
}
export function ClipList({
  clips,
  isLoading,
  hasMore,
  resetToken,
  selectedClipId,
  onSelectClip,
  onPaste,
  onCopy,
  onLoadMore,
  onDragStart,
  onCardContextMenu,
}: ClipListProps) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);

  const [hoveredClipId, setHoveredClipId] = useState<string | null>(null);
  const [previewClipId, setPreviewClipId] = useState<string | null>(null);
  const [fullTextContent, setFullTextContent] = useState<string>('');
  const [loadingText, setLoadingText] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);
  const [copiedPreview, setCopiedPreview] = useState(false);

  const previewClip = useMemo(
    () => clips.find((c) => c.id === previewClipId) ?? null,
    [clips, previewClipId]
  );

  const fullImageSrc = useMemo(() => resolveFullImageSrc(previewClip), [previewClip]);

  const isPreviewCode = useMemo(() => {
    if (!previewClip || previewClip.clip_type === 'image') return false;
    const text = fullTextContent || previewClip.content || '';
    return /[{};()=>]|const |function |import |def |class |cmd |pnpm |npm /.test(text);
  }, [previewClip, fullTextContent]);

  const openPreview = useCallback(async (clip: ClipboardItem) => {
    try {
      await invoke('set_preview_mode', { active: true });
    } catch {
      // Ignore if unavailable
    }

    setIsZoomed(false);
    setPreviewClipId(clip.id);

    if (clip.clip_type !== 'image') {
      setFullTextContent(clip.content || '');
      setLoadingText(true);
      try {
        const detail = await invoke<{ content?: string } | string | null>('get_clip_detail', {
          id: clip.id,
        });
        if (typeof detail === 'string' && detail.length > 0) {
          setFullTextContent(detail);
        } else if (detail && typeof detail === 'object' && detail.content) {
          setFullTextContent(detail.content);
        }
      } catch {
        try {
          const fullClip = await invoke<ClipboardItem | null>('get_clip', { id: clip.id });
          if (fullClip?.content) {
            setFullTextContent(fullClip.content);
          }
        } catch {
          // Keep existing content fallback
        }
      } finally {
        setLoadingText(false);
      }
    }
  }, []);

  const closePreview = useCallback(async () => {
    setPreviewClipId(null);
    setFullTextContent('');
    setIsZoomed(false);
    try {
      await invoke('set_preview_mode', { active: false });
    } catch {
      // Ignore if unavailable
    }
  }, []);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = 0;
    }
    if (previewClipId) {
      closePreview();
    }
  }, [resetToken]);

  useEffect(() => {
    if (!selectedClipId || !containerRef.current) return;
    const el = containerRef.current.querySelector(`[data-clip-id="${selectedClipId}"]`);
    if (el) {
      el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [selectedClipId]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTyping =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable);

      if (isTyping) return;

      if (previewClipId) {
        if (e.code === 'Space' || e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          closePreview();
        }
        return;
      }

      if (e.code === 'Space') {
        const targetId = hoveredClipId || selectedClipId;
        if (!targetId) return;
        const targetClip = clips.find((c) => c.id === targetId);
        if (!targetClip) return;

        const isLargeText =
          targetClip.clip_type !== 'image' &&
          ((targetClip.content?.length ?? 0) > 80 ||
            (targetClip.content?.includes('\n') ?? false));

        if (targetClip.clip_type === 'image' || isLargeText) {
          e.preventDefault();
          e.stopPropagation();
          openPreview(targetClip);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [clips, hoveredClipId, selectedClipId, previewClipId, openPreview, closePreview]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (!hasMore || isLoading) return;
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - scrollTop - clientHeight < 160) {
      onLoadMore();
    }
  };

const textStats = useMemo(() => {
    const text = fullTextContent || '';
    const lines = text ? text.split(/\r?\n/).length : 0;
    return { chars: text.length, lines };
  }, [fullTextContent]);

  if (isLoading && clips.length === 0) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          <p className="text-xs text-muted-foreground">{t('clipList.loadingClips')}</p>
        </div>
      </div>
    );
  }

  if (clips.length === 0) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center p-8 text-center">
        <h3 className="mb-1 text-sm font-semibold text-foreground/70">{t('clipList.empty')}</h3>
        <p className="max-w-[220px] text-xs text-muted-foreground">{t('clipList.emptyDesc')}</p>
      </div>
    );
  }

  return (
    <>
      <div
        ref={containerRef}
        data-el="clip-list"
        onScroll={handleScroll}
        className="no-scrollbar flex h-full w-full flex-col gap-3 overflow-y-auto overflow-x-hidden px-3.5 py-3"
      >
        {clips.map((clip) => (
          <div
            key={clip.id}
            onMouseEnter={() => setHoveredClipId(clip.id)}
            onMouseLeave={() => setHoveredClipId((prev) => (prev === clip.id ? null : prev))}
            className="w-full"
          >
            <ClipCard
              clip={clip}
              isSelected={selectedClipId === clip.id}
              onSelect={() => onSelectClip(clip.id)}
              onPaste={() => onPaste(clip.id)}
              onCopy={() => onCopy(clip.id)}
              onDragStart={onDragStart}
              onContextMenu={(e: React.MouseEvent) => onCardContextMenu?.(e, clip.id)}
            />
          </div>
        ))}
      </div>

      {previewClip && (
        <div
          onClick={closePreview}
          className="fixed inset-0 z-50 flex flex-col bg-black/90 backdrop-blur-2xl"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex flex-shrink-0 items-center justify-between border-b border-white/10 bg-white/[0.04] px-5 py-3"
          >
            <div className="flex items-center gap-2.5 text-xs text-white/85">
              {previewClip.source_icon ? (
                <img
                  src={`data:image/png;base64,${previewClip.source_icon}`}
                  alt=""
                  className="h-4 w-4 object-contain"
                />
              ) : isPreviewCode ? (
                <Code2 size={15} className="text-violet-400" />
              ) : (
                <FileText size={15} className="text-white/70" />
              )}
              <span className="font-semibold">
                {previewClip.source_app ||
                  (previewClip.clip_type === 'image' ? 'Image Preview' : 'Document Preview')}
              </span>
              {previewClip.clip_type !== 'image' && textStats.chars > 0 && (
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-white/70">
                  {textStats.lines} lines • {textStats.chars.toLocaleString()} chars
                </span>
              )}
              <span className="text-white/40">• Press Space or Esc to close</span>
            </div>

            <div className="flex items-center gap-2">
              {previewClip.clip_type === 'image' && (
                <button
                  onClick={() => setIsZoomed((z) => !z)}
                  className="rounded-lg border border-white/10 bg-white/10 p-1.5 text-white/85 transition-colors hover:bg-white/20"
                  title={isZoomed ? 'Fit to screen' : '100% actual size'}
                >
                  {isZoomed ? <ZoomOut size={15} /> : <ZoomIn size={15} />}
                </button>
              )}
              <button
                onClick={() => {
                  onCopy(previewClip.id);
                  setCopiedPreview(true);
                  setTimeout(() => setCopiedPreview(false), 1800);
                }}
                className="rounded-lg border border-white/10 bg-white/10 p-1.5 text-white/85 transition-colors hover:bg-white/20"
                title="Copy full content"
              >
                {copiedPreview ? (
                  <Check size={15} className="text-emerald-400" />
                ) : (
                  <Copy size={15} />
                )}
              </button>
              <button
                onClick={closePreview}
                className="rounded-lg border border-white/10 bg-white/10 p-1.5 text-white/85 transition-colors hover:bg-white/20"
                title="Close (Esc / Space)"
              >
                <X size={15} />
              </button>
            </div>
          </div>

          {previewClip.clip_type === 'image' && fullImageSrc ? (
            <div
              onClick={(e) => {
                e.stopPropagation();
                setIsZoomed((z) => !z);
              }}
              className="flex min-h-0 flex-1 cursor-zoom-in items-center justify-center overflow-auto p-6"
            >
              <img
                src={fullImageSrc}
                alt="Full quality preview"
                className={
                  isZoomed
                    ? 'max-w-none cursor-zoom-out rounded-lg shadow-2xl'
                    : 'max-h-full max-w-full rounded-lg object-contain shadow-2xl'
                }
              />
            </div>
          ) : (
                     <div
            onClick={(e) => e.stopPropagation()}
            className="flex min-h-0 flex-1 items-start justify-center overflow-y-auto px-6 pb-14 pt-6"
          >
            <div className="h-fit w-full max-w-3xl rounded-2xl border border-white/10 bg-white/[0.04] p-8 shadow-2xl">
                {loadingText ? (
                  <div className="flex items-center justify-center py-12 text-xs text-white/60">
                    Loading full text...
                  </div>
                ) : isPreviewCode ? (
                  <pre className="select-text whitespace-pre-wrap break-words font-mono text-[13px] leading-relaxed text-white/95">
                    {fullTextContent}
                  </pre>
                ) : (
                  <FormattedNoteView content={fullTextContent} />
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
