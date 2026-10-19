import React, { useState, useEffect, useRef, useMemo } from 'react';
import { FileText, Maximize2, AlertCircle, Table, FileCode } from 'lucide-react';
import Skeleton from './ui/Skeleton';
import { cn } from '../lib/utils';
import { LectureContent } from '../constants';
import { useDocumentTracking } from '../lib/useDocumentTracking';
import { useDocumentProgress } from '../lib/DocumentProgressContext';
import { useMissions } from '../lib/MissionsContext';

interface DocViewerProps {
  lecture: LectureContent;
  zoom: number;
  onUnitsCalculated?: (count: number) => void;
}

export default function DocViewer({ lecture, zoom, onUnitsCalculated }: DocViewerProps) {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { getLastPosition } = useDocumentProgress();
  const { trackActivity } = useMissions();

  // Track activity on mount
  useEffect(() => {
    trackActivity({
      title: `Reading: ${lecture.title}`,
      duration: '15m',
      type: 'reading',
      topic: lecture.course,
      metadata: { lectureId: lecture.id }
    });
  }, [lecture.id, lecture.title, lecture.course, trackActivity]);

  // Split text into readable units (paragraphs)
  const textUnits = useMemo(() => {
    if (lecture.type !== 'txt' || !content) return [];
    return content.split(/\n\s*\n/).filter(u => u.trim().length > 0);
  }, [content, lecture.type]);

  // Split CSV into blocks of rows
  const csvBlocks = useMemo(() => {
    if (lecture.type !== 'csv' || !content) return [];
    const lines = content.split('\n').filter(l => l.trim().length > 0);
    const rows = lines.map(line => line.split(','));
    const blockSize = 5;
    const blocks = [];
    for (let i = 0; i < rows.length; i += blockSize) {
      blocks.push({
        startIndex: i,
        rows: rows.slice(i, i + blockSize)
      });
    }
    return blocks;
  }, [content, lecture.type]);

  const totalUnits = lecture.type === 'txt' ? textUnits.length : lecture.type === 'csv' ? csvBlocks.length : (lecture.type === 'doc' || lecture.type === 'spreadsheet') ? 1 : 0;

  useEffect(() => {
    if (onUnitsCalculated) {
      onUnitsCalculated(totalUnits);
    }
  }, [totalUnits, onUnitsCalculated]);

  useDocumentTracking(
    lecture.id,
    totalUnits,
    (lecture.type === 'doc' || lecture.type === 'spreadsheet') ? 'doc_base_view' : null,
    containerRef,
    '.readable-unit',
    !loading && (!!content || lecture.type === 'doc' || lecture.type === 'spreadsheet')
  );

  // Resume Functionality: Scroll to last unit
  useEffect(() => {
    if (loading || !content || !containerRef.current) return;
    
    const lastId = getLastPosition(lecture.id);
    if (lastId) {
      const timer = setTimeout(() => {
        const unit = containerRef.current?.querySelector(`[data-unit-id="${lastId}"]`);
        if (unit) {
          unit.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [loading, content, lecture.id, getLastPosition]);

  useEffect(() => {
    const fetchDocContent = async () => {
      if (!lecture.url) return;

      // Only attempt to fetch text-based files for parsing
      const isTextBased = ['txt', 'csv'].includes(lecture.type);
      
      if (!isTextBased) {
        setContent(null);
        setLoading(false);
        setError(null);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const response = await fetch(lecture.url);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const text = await response.text();
        setContent(text);
        setError(null);
      } catch (err) {
        const isLocal = lecture.url?.startsWith('blob:') || lecture.url?.startsWith('data:');
        
        // Suppress expected CORS or network errors in console
        const isNetworkError = err instanceof TypeError || 
                             (err instanceof Error && err.message.toLowerCase().includes('fetch'));
        
        if (isLocal && !isNetworkError) {
          console.error("Error fetching local doc content:", err);
        }
        
        if (!isLocal) {
          // For remote files, we'll likely fallback to Google Viewer if it was a CORS/Network block
          setError("Direct preview was blocked by the host. Switching to alternative viewer...");
        } else {
          setError(isNetworkError ? "The file is no longer available in memory. Please try re-uploading." : "Failed to read the local file.");
        }
      } finally {
        setLoading(false);
      }
    };

    fetchDocContent();
  }, [lecture.url, lecture.type]);

  if (loading) {
    return (
      <div className="w-full h-64 flex flex-col items-center justify-center gap-4">
        <div className="relative">
          <div className="space-y-4 w-full max-w-lg">
            <Skeleton className="w-full h-8" borderRadius="8px" />
            <Skeleton className="w-full h-4" borderRadius="4px" />
            <Skeleton className="w-3/4 h-4" borderRadius="4px" />
            <div className="pt-8 space-y-2">
              <Skeleton className="w-full h-12" borderRadius="12px" />
              <Skeleton className="w-full h-12" borderRadius="12px" />
            </div>
          </div>
          <div className="absolute inset-0 blur-lg bg-brand-primary/20 animate-pulse"></div>
        </div>
        <p className="text-[10px] font-black uppercase tracking-widest text-white/40">Loading Document...</p>
      </div>
    );
  }

  if (error) {
    const isRemote = lecture.url && !lecture.url.startsWith('blob:') && !lecture.url.startsWith('data:');

    if (isRemote && (lecture.type === 'txt' || lecture.type === 'csv')) {
        return (
            <div className="w-full h-full max-w-6xl bg-white rounded-3xl overflow-hidden shadow-2xl mx-auto ring-4 ring-black/20">
                <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 px-4 py-2 bg-yellow-500/90 text-black text-[10px] font-black uppercase tracking-widest rounded-full shadow-xl">
                    Using Secure Viewer (CORS Fallback)
                </div>
                <iframe 
                    src={`https://docs.google.com/viewer?url=${encodeURIComponent(lecture.url || '')}&embedded=true`}
                    className="w-full h-full border-none"
                    title={lecture.title}
                />
            </div>
        );
    }

    return (
      <div className="w-full max-w-md mx-auto p-12 glass border-red-500/20 rounded-[40px] text-center space-y-6">
        <div className="w-20 h-20 rounded-3xl bg-red-500/10 text-red-400 flex items-center justify-center mx-auto ring-1 ring-red-500/20">
          <AlertCircle size={40} />
        </div>
        <div className="space-y-2">
          <h4 className="text-sm font-black text-white uppercase italic tracking-tight">Preview Unavailable</h4>
          <p className="text-xs text-white/40 font-medium leading-relaxed">{error}</p>
        </div>
        <div className="flex flex-col gap-3 pt-4">
          <a 
            href={lecture.url} 
            target="_blank" 
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white/5 border border-white/10 text-white font-black uppercase text-[10px] tracking-widest rounded-2xl hover:bg-white/10 transition-all"
          >
            Open in New Tab
          </a>
          {lecture.url?.startsWith('blob:') && (
            <a 
              href={lecture.url} 
              download={`${lecture.title}.${lecture.type}`}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-brand-primary text-dark-bg font-black uppercase text-[10px] tracking-widest rounded-2xl hover:scale-105 active:scale-95 transition-all"
            >
              Download File
            </a>
          )}
        </div>
      </div>
    );
  }

  // Handle Text files
  if (lecture.type === 'txt') {
    return (
      <div className="w-full max-w-4xl mx-auto p-4 sm:p-8 h-full overflow-y-auto scrollbar-hide" ref={containerRef}>
        <div 
          className="glass border-white/5 rounded-[32px] p-8 sm:p-12 transition-all duration-300 shadow-2xl relative overflow-hidden"
          style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top center' }}
        >
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-brand-primary/20 to-transparent"></div>
          <div className="space-y-8">
            {textUnits.map((unit, i) => (
              <pre key={i} data-unit-id={`txt_${i}`} className="readable-unit text-sm text-white/80 whitespace-pre-wrap font-mono leading-loose">
                {unit}
              </pre>
            ))}
            {textUnits.length === 0 && <p className="text-white/20">No content available</p>}
          </div>
        </div>
      </div>
    );
  }

  // Handle CSV
  if (lecture.type === 'csv') {
    return (
      <div className="w-full max-w-6xl mx-auto p-4 sm:p-8 h-full overflow-y-auto scrollbar-hide" ref={containerRef}>
        <div 
          className="glass border-white/5 rounded-[32px] overflow-hidden shadow-2xl transition-all duration-300 ring-1 ring-white/10"
          style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top center' }}
        >
          <div className="overflow-x-auto scrollbar-hide">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-white/5">
                  {csvBlocks[0]?.rows[0]?.map((cell, i) => (
                    <th key={i} className="text-[10px] font-black uppercase tracking-widest text-white/60 p-5 text-left border-b border-white/10 whitespace-nowrap">
                      {cell.replace(/"/g, '')}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {csvBlocks.map((block, bIdx) => (
                   <React.Fragment key={bIdx}>
                     {block.rows.map((row, rIdx) => (
                       <tr 
                        key={`${bIdx}-${rIdx}`} 
                        data-unit-id={`csv_${bIdx}`} 
                        className={cn(
                          "border-b border-white/5 hover:bg-white/5 transition-colors group",
                          rIdx === 0 && "readable-unit" // Marker for the block
                        )}
                       >
                         {row.map((cell, j) => (
                           <td key={j} className="p-5 text-sm text-white/40 group-hover:text-white/80 font-medium whitespace-nowrap transition-colors">
                             {cell.replace(/"/g, '')}
                           </td>
                         ))}
                       </tr>
                     ))}
                   </React.Fragment>
                ))}
              </tbody>
            </table>
            {csvBlocks.length === 0 && (
              <div className="p-16 text-center text-white/20">
                <Table size={48} className="mx-auto mb-4 opacity-50" />
                <p className="text-xs font-bold uppercase tracking-widest">No data detected</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Handle Excel and Word Documents
  if (lecture.type === 'doc' || lecture.type === 'spreadsheet') {
    const isLocal = lecture.url?.startsWith('blob:');
    
    if (isLocal) {
        return (
            <div className="w-full max-w-md mx-auto p-12 glass border-white/10 rounded-[40px] text-center space-y-8">
                <div className="w-24 h-24 rounded-[32px] bg-brand-primary/10 text-brand-primary flex items-center justify-center mx-auto ring-1 ring-brand-primary/20">
                    {lecture.type === 'doc' ? <FileText size={48} /> : <Table size={48} />}
                </div>
                <div className="space-y-3">
                    <h4 className="text-lg font-black text-white uppercase italic tracking-tighter">
                        {lecture.type === 'doc' ? 'Document' : 'Spreadsheet'} Ready
                    </h4>
                    <p className="text-xs text-white/40 font-medium leading-relaxed px-4">
                        Direct preview for {lecture.type === 'doc' ? 'Word' : 'Excel'} files is limited in the browser. Download to view with full formatting.
                    </p>
                </div>
                <a 
                    href={lecture.url} 
                    download={`${lecture.title}.${lecture.type === 'doc' ? 'docx' : 'xlsx'}`}
                    className="inline-flex items-center gap-3 px-8 py-4 bg-brand-primary text-dark-bg font-black uppercase text-[11px] tracking-[0.2em] rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-[0_0_20px_rgba(var(--brand-primary-rgb),0.3)]"
                >
                    Download to View
                </a>
            </div>
        );
    }

    // Fallback for remote URLs using Google Docs Viewer
    return (
      <div className="w-full h-full max-w-6xl bg-white rounded-3xl overflow-hidden shadow-2xl mx-auto ring-4 ring-black/20">
        <iframe 
          src={`https://docs.google.com/viewer?url=${encodeURIComponent(lecture.url || '')}&embedded=true`}
          className="w-full h-full border-none"
          title={lecture.title}
        />
      </div>
    );
  }

  return null;
}
