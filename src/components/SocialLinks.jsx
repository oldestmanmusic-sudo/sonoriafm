import { Instagram, Youtube, Music2, Twitter, Facebook } from 'lucide-react';

export const SONORIA_SOCIALS = [
{ name: 'Instagram', url: 'https://instagram.com/sonoria.radio', Icon: Instagram },
{ name: 'YouTube', url: 'https://youtube.com/@sonoria', Icon: Youtube },
{ name: 'Spotify', url: 'https://open.spotify.com/', Icon: Music2 },
{ name: 'X', url: 'https://x.com/sonoria', Icon: Twitter },
{ name: 'Facebook', url: 'https://facebook.com/sonoria.radio', Icon: Facebook }];


export default function SocialLinks({ className = '' }) {
  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {SONORIA_SOCIALS.map(({ name, url, Icon }) =>
      <a
        key={name}
        href={url}
        target="_blank"
        rel="noreferrer noopener"
        className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground hidden">
        
          <Icon className="h-4 w-4 text-primary" />
          {name}
        </a>
      )}
    </div>);

}