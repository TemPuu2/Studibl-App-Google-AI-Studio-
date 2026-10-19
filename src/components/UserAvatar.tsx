import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { cn } from '../lib/utils';
import { User } from 'lucide-react';

// Global in-memory cache for resolved signed URLs to avoid redundant storage API calls
const resolvedAvatarCache = new Map<string, string>();

/**
 * Extracts initials from a user's display name or email
 */
export function getInitials(name?: string | null): string {
  if (!name || typeof name !== 'string') return 'U';
  const cleanName = name.includes('@') ? name.split('@')[0] : name;
  const clean = cleanName.trim();
  if (!clean) return 'U';
  const parts = clean.split(/[\s._+-]+/);
  if (parts.length >= 2 && parts[0] && parts[parts.length - 1]) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return clean.substring(0, Math.min(2, clean.length)).toUpperCase();
}

/**
 * Resolves an avatar source (storage filepath, cached URL, or external URL) to a valid image src.
 * Never returns placeholder mock images like dicebear/picsum.
 */
export function getOptimisticAvatar(src?: string | null, _name: string = 'User'): string {
  if (!src || typeof src !== 'string' || !src.trim()) {
    return '';
  }

  const trimmed = src.trim();

  // If already absolute URL or data URI
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('blob:')
  ) {
    return trimmed;
  }

  // Check if we have a resolved cache entry
  if (resolvedAvatarCache.has(trimmed)) {
    return resolvedAvatarCache.get(trimmed)!;
  }

  return '';
}

interface UserAvatarProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src?: string | null;
  name?: string;
  className?: string;
  fallbackSeed?: string;
}

/**
 * UserAvatar Component
 * Displays the authentic user avatar from Supabase or storage paths.
 * If no profile picture is available or if loading fails, it displays a designated clean default empty state (styled initials / avatar icon) with zero mock or random imagery.
 */
export default function UserAvatar({
  src,
  name = 'User',
  className,
  fallbackSeed,
  alt,
  ...props
}: UserAvatarProps) {
  const seedName = fallbackSeed || name || 'User';
  const [resolvedSrc, setResolvedSrc] = useState<string>(() => getOptimisticAvatar(src, seedName));
  const [hasError, setHasError] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(Boolean(src && src.trim()));

  useEffect(() => {
    let isMounted = true;
    setHasError(false);

    if (!src || typeof src !== 'string' || !src.trim()) {
      setResolvedSrc('');
      setIsLoading(false);
      return;
    }

    const trimmed = src.trim();

    // If already absolute URL or data URI
    if (
      trimmed.startsWith('http://') ||
      trimmed.startsWith('https://') ||
      trimmed.startsWith('data:') ||
      trimmed.startsWith('blob:')
    ) {
      setResolvedSrc(trimmed);
      setIsLoading(false);
      return;
    }

    // Check memory cache
    if (resolvedAvatarCache.has(trimmed)) {
      setResolvedSrc(resolvedAvatarCache.get(trimmed)!);
      setIsLoading(false);
      return;
    }

    // Asynchronously create signed URL from Supabase storage
    const resolveSupabasePath = async () => {
      try {
        const { data, error } = await supabase.storage
          .from('app-files')
          .createSignedUrl(trimmed, 60 * 60 * 24 * 7); // 7 days

        if (!error && data?.signedUrl && isMounted) {
          resolvedAvatarCache.set(trimmed, data.signedUrl);
          setResolvedSrc(data.signedUrl);
          setIsLoading(false);
          return;
        }
      } catch (err) {
        console.warn('[UserAvatar] Notice signing avatar storage path:', err);
      }

      // Try public URL
      try {
        const { data: pubData } = supabase.storage.from('app-files').getPublicUrl(trimmed);
        if (pubData?.publicUrl && isMounted) {
          resolvedAvatarCache.set(trimmed, pubData.publicUrl);
          setResolvedSrc(pubData.publicUrl);
          setIsLoading(false);
          return;
        }
      } catch (pubErr) {}

      if (isMounted) {
        setResolvedSrc('');
        setIsLoading(false);
      }
    };

    resolveSupabasePath();

    return () => {
      isMounted = false;
    };
  }, [src, seedName]);

  const initials = useMemo(() => getInitials(seedName), [seedName]);

  // If no valid image source or if the image failed to load, display the designated clean empty state
  if (!resolvedSrc || hasError) {
    return (
      <div
        className={cn(
          "bg-gradient-to-br from-brand-primary/20 via-brand-primary/10 to-dark-bg/80 text-brand-primary font-black uppercase flex items-center justify-center border border-brand-primary/20 shrink-0 select-none overflow-hidden",
          className
        )}
        title={name}
        aria-label={name}
      >
        {initials ? (
          <span className="text-[0.42em] leading-none tracking-tight font-black">{initials}</span>
        ) : (
          <User className="w-1/2 h-1/2 opacity-70" />
        )}
      </div>
    );
  }

  return (
    <img
      src={resolvedSrc}
      alt={alt || name}
      onError={() => {
        setHasError(true);
      }}
      referrerPolicy="no-referrer"
      className={cn("object-cover shrink-0", className)}
      {...props}
    />
  );
}
