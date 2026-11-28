import { Instagram, Music2, Youtube } from 'lucide-react';

// Solo las cuentas oficiales (las mismas que declara index.html en "sameAs").
export const SONORIA_SOCIALS = [
{ name: 'Instagram', url: 'https://www.instagram.com/sonoria.fm', Icon: Instagram },
{ name: 'YouTube', url: 'https://www.youtube.com/@sonoriafm', Icon: Youtube },
{ name: 'TikTok', url: 'https://www.tiktok.com/@sonoria.fm', Icon: Music2 }];


export default function SocialLinks({ className = '' }) {
  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {SONORIA_SOCIALS.map(({ name, url, Icon }) =>
      <a
        key={name}
        href={url}
        target="_blank"
        rel="noreferrer noopener"
        className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground">

          <Icon className="h-4 w-4 text-primary" />
          {name}
        </a>
      )}
    </div>);

}
