import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'wouter';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useGetVideoInfo, getGetVideoInfoQueryKey, useCreateDownload } from '@workspace/api-client-react';
import { useJobProgress } from '@/hooks/use-job-progress';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Badge } from '@/components/ui/badge';
import { Download, Music, Video, AlertCircle, Loader2, List } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import UpgradeBanner, { ProBadge } from '@/components/UpgradeBanner';
import { getFeatureGates } from '@/lib/subscriptionService';

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

const formSchema = z.object({
  url: z.string().min(1, 'URL is required'),
  format: z.enum(['mp3', 'm4a', 'mp4']).default('mp3'),
});

type FormValues = z.infer<typeof formSchema>;

interface PlaylistEntry {
  url: string;
  title: string;
  duration: number;
  thumbnail: string;
}

function isPlaylistUrl(url: string): boolean {
  return /[?&]list=/.test(url) && /youtu/i.test(url);
}

function formatDuration(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatBytes(bytes: number | null | undefined) {
  if (!bytes) return null;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function VideoItem({
  url,
  format,
  prefetchedInfo,
  autoDownload,
}: {
  url: string;
  format: 'mp3' | 'm4a' | 'mp4';
  prefetchedInfo?: PlaylistEntry;
  autoDownload?: boolean;
}) {
  const skip = !!prefetchedInfo;
  const { data: fetchedInfo, isLoading, isError, error } = useGetVideoInfo(
    { url },
    { query: { enabled: !skip && !!url, queryKey: getGetVideoInfoQueryKey({ url }), retry: false } }
  );

  const videoInfo = prefetchedInfo
    ? { title: prefetchedInfo.title, duration: prefetchedInfo.duration, thumbnail: prefetchedInfo.thumbnail, filesize: null, bitrate: null }
    : fetchedInfo;

  const [jobId, setJobId] = useState<string | null>(null);
  const createDownload = useCreateDownload();
  const progress = useJobProgress(jobId);
  const autoTriggered = useRef(false);

  const handleDownload = () => {
    if (createDownload.isPending || jobId) return;
    createDownload.mutate(
      { data: { url, format } },
      { onSuccess: (data) => setJobId(data.jobId) }
    );
  };

  useEffect(() => {
    if (autoDownload && videoInfo && !jobId && !autoTriggered.current) {
      autoTriggered.current = true;
      setTimeout(handleDownload, Math.random() * 400);
    }
  }, [autoDownload, videoInfo]);

  if (!skip && isLoading) {
    return (
      <Card className="border-border/50 bg-card overflow-hidden">
        <CardContent className="p-0 flex flex-col sm:flex-row h-full">
          <Skeleton className="w-full sm:w-48 h-32 rounded-none" />
          <div className="p-4 flex flex-col justify-between flex-1 gap-4">
            <div className="space-y-2">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
            <Skeleton className="h-9 w-32" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!skip && isError) {
    return (
      <Alert variant="destructive" className="bg-destructive/10 border-destructive/20 text-destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Failed to fetch info for {url}. {error?.error || 'Invalid URL or private video.'}
        </AlertDescription>
      </Alert>
    );
  }

  if (!videoInfo) return null;

  return (
    <Card className="border-border/50 bg-card overflow-hidden transition-all duration-300">
      <CardContent className="p-0 flex flex-col sm:flex-row h-full group">
        <div className="relative w-full sm:w-48 h-32 shrink-0 bg-muted">
          <img src={videoInfo.thumbnail} alt={videoInfo.title} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
          <div className="absolute bottom-2 right-2 bg-black/80 px-1.5 py-0.5 rounded text-xs font-mono text-white">
            {formatDuration(videoInfo.duration)}
          </div>
        </div>

        <div className="p-4 flex flex-col justify-between flex-1 min-w-0">
          <div>
            <h3 className="font-medium text-foreground truncate" title={videoInfo.title}>{videoInfo.title}</h3>
            <div className="flex gap-3 mt-1 text-xs text-muted-foreground font-mono">
              {videoInfo.filesize && <span>{formatBytes(videoInfo.filesize)}</span>}
              {videoInfo.bitrate && <span>{Math.round(videoInfo.bitrate)} kbps</span>}
              <span className="uppercase">{format}</span>
            </div>
          </div>

          <div className="mt-4">
            {!jobId ? (
              <Button
                onClick={handleDownload}
                disabled={createDownload.isPending}
                className="w-full sm:w-auto text-primary-foreground font-medium"
              >
                {createDownload.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                Download
              </Button>
            ) : (
              <div className="space-y-3">
                {progress.status === 'error' ? (
                  <Alert variant="destructive" className="py-2 px-3 bg-destructive/10 border-destructive/20 text-destructive">
                    <AlertDescription className="text-sm font-mono">{progress.error || 'Download failed'}</AlertDescription>
                  </Alert>
                ) : progress.status === 'done' ? (
                  <Button asChild className="w-full sm:w-auto bg-green-500 hover:bg-green-600 text-black">
                    <a href={`${BASE}/api/downloads/${jobId}/file`} download>
                      <Download className="mr-2 h-4 w-4" /> Save File
                    </a>
                  </Button>
                ) : (
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-mono text-muted-foreground capitalize">
                      <span>{progress.status}</span>
                      {progress.progress > 0 && <span>{Math.round(progress.progress)}%</span>}
                    </div>
                    <Progress value={progress.progress || 0} className="h-2 rounded bg-muted" indicatorClassName={progress.status === 'done' ? 'bg-green-500' : 'bg-primary'} />
                    <div className="flex justify-between text-[10px] font-mono text-muted-foreground/60">
                      <span>{progress.speed || '--'}</span>
                      <span>{progress.eta ? `ETA ${progress.eta}` : '--'}</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Home() {
  const [, navigate] = useLocation();
  const gates = getFeatureGates();
  const [items, setItems] = useState<{ url: string; format: 'mp3' | 'm4a' | 'mp4'; prefetchedInfo?: PlaylistEntry }[]>([]);
  const [playlistLoading, setPlaylistLoading] = useState(false);
  const [playlistError, setPlaylistError] = useState<string | null>(null);
  const [playlistMeta, setPlaylistMeta] = useState<{ count: number; name?: string } | null>(null);
  const [autoDownloadAll, setAutoDownloadAll] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { url: '', format: 'mp3' },
  });

  const onSubmit = async (data: FormValues) => {
    setPlaylistError(null);
    setPlaylistMeta(null);
    setAutoDownloadAll(false);

    const rawUrl = data.url.trim();

    if (isPlaylistUrl(rawUrl)) {
      setPlaylistLoading(true);
      setItems([]);
      try {
        const resp = await fetch(`${BASE}/api/playlist-info?url=${encodeURIComponent(rawUrl)}`);

        // PATCH Bug 3: Guard resp.json() separately so a non-JSON response
        // (e.g. an HTML Netlify timeout page) surfaces a clear error instead
        // of a generic JS parse exception landing in the catch block.
        let json: Record<string, unknown>;
        try {
          json = await resp.json();
        } catch {
          setPlaylistError(
            `Unexpected response from server (status ${resp.status}). ` +
            `The playlist service may be temporarily unavailable — please try again.`
          );
          return;
        }

        if (!resp.ok) {
          setPlaylistError(json.error || 'Failed to fetch playlist');
          return;
        }
        const entries: PlaylistEntry[] = json.entries || [];
        setItems(entries.map((e) => ({ url: e.url, format: data.format, prefetchedInfo: e })));
        setPlaylistMeta({ count: json.count });
      } catch (e) {
        // PATCH Bug 3: Surface the real error message so it is actionable.
        const detail = e instanceof Error ? e.message : String(e);
        setPlaylistError(`Network error fetching playlist (${detail})`);
      } finally {
        setPlaylistLoading(false);
      }
      return;
    }

    const inputUrls = rawUrl.split(',').map((u) => u.trim()).filter(Boolean);
    setItems(inputUrls.map((url) => ({ url, format: data.format })));
  };

  const handleDownloadAll = () => {
    setAutoDownloadAll(true);
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans selection:bg-primary selection:text-primary-foreground">
      <header className="border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-primary flex items-center justify-center text-primary-foreground">
            <Music className="w-5 h-5" />
          </div>
          <h1 className="font-bold tracking-tight text-lg">Audio Downloader</h1>
          <div className="ml-auto flex items-center gap-3">
            {gates.hideBanner && (
              <Badge variant="outline" className="border-primary/40 text-primary text-[10px] font-bold uppercase tracking-wider px-2">
                Pro
              </Badge>
            )}
            <button
              onClick={() => navigate('/pricing')}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors font-medium"
            >
              Pricing
            </button>
          </div>
        </div>
      </header>

      {/* Upgrade banner — hidden for Pro users */}
      <UpgradeBanner />

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-8 flex flex-col gap-8">
        <div className="bg-card border border-border/50 rounded-lg p-6 shadow-sm">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="url"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Input
                        placeholder="Paste YouTube video or playlist URL(s)..."
                        className="h-14 text-lg bg-muted/50 border-border font-mono placeholder:text-muted-foreground/50 focus-visible:ring-primary"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className="text-destructive font-mono text-sm" />
                  </FormItem>
                )}
              />

              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <FormField
                  control={form.control}
                  name="format"
                  render={({ field }) => (
                    <FormItem className="w-full sm:w-auto">
                      <FormControl>
                        <ToggleGroup
                          type="single"
                          value={field.value}
                          onValueChange={(val) => val && field.onChange(val)}
                          className="justify-start border border-border/50 rounded-md p-1 bg-muted/30"
                        >
                          <ToggleGroupItem value="mp3" className="px-5 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
                            <Music className="mr-1.5 h-3.5 w-3.5" />MP3
                          </ToggleGroupItem>
                          <ToggleGroupItem value="m4a" className="px-5 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
                            <Music className="mr-1.5 h-3.5 w-3.5" />M4A
                          </ToggleGroupItem>
                          <ToggleGroupItem
                            value="mp4"
                            disabled={!gates.mp4Format}
                            className="px-5 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground disabled:opacity-60"
                          >
                            <Video className="mr-1.5 h-3.5 w-3.5" />MP4
                            {!gates.mp4Format && <ProBadge />}
                          </ToggleGroupItem>
                        </ToggleGroup>
                      </FormControl>
                    </FormItem>
                  )}
                />

                <Button type="submit" size="lg" disabled={playlistLoading} className="w-full sm:w-auto font-bold uppercase tracking-wider text-primary-foreground px-8">
                  {playlistLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Fetch Info
                </Button>
              </div>
            </form>
          </Form>
        </div>

        {playlistError && (
          <Alert variant="destructive" className="bg-destructive/10 border-destructive/20 text-destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{playlistError}</AlertDescription>
          </Alert>
        )}

        <div className="flex-1 flex flex-col gap-4">
          {items.length === 0 && !playlistLoading ? (
            <div className="flex-1 flex items-center justify-center flex-col text-muted-foreground/50 py-12 border-2 border-dashed border-border/20 rounded-lg">
              <Music className="w-12 h-12 mb-4 opacity-20" />
              <p className="font-mono text-sm">Paste any YouTube URL or playlist to get started</p>
            </div>
          ) : (
            <>
              {playlistMeta && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <List className="h-4 w-4" />
                    <span className="font-mono">Playlist</span>
                    <Badge variant="secondary" className="font-mono text-xs">{playlistMeta.count} videos</Badge>
                  </div>
                  {gates.playlistDownload ? (
                    <Button
                      size="sm"
                      onClick={handleDownloadAll}
                      disabled={autoDownloadAll}
                      className="gap-2 font-medium text-primary-foreground"
                    >
                      <Download className="h-4 w-4" />
                      {autoDownloadAll ? 'Downloading all…' : 'Download All'}
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => navigate('/pricing')}
                      className="gap-2 font-medium border-primary/40 text-primary hover:bg-primary/10"
                    >
                      <ProBadge />
                      Unlock Download All
                    </Button>
                  )}
                </div>
              )}
              <div className="space-y-4">
                {items.map((item, i) => (
                  <VideoItem
                    key={`${item.url}-${i}`}
                    url={item.url}
                    format={item.format}
                    prefetchedInfo={item.prefetchedInfo}
                    autoDownload={autoDownloadAll}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </main>

      <footer className="py-6 text-center border-t border-border/20">
        <p className="text-xs font-mono text-muted-foreground/40">Built with yt-dlp · FFmpeg · Express</p>
      </footer>
    </div>
  );
}
