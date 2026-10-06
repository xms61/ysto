// An anime's name in the player's title language, and below it, smaller, in their second one when it differs.
import type { RevealDetails } from '../../shared/protocol.ts';
import { animeTitle } from '../format.ts';
import type { TitleLanguages } from '../format.ts';

export function AnimeName({ anime, titles }: { anime: RevealDetails['anime']; titles: TitleLanguages }) {
  const title = animeTitle(anime, titles.first);
  const second = titles.second ? animeTitle(anime, titles.second) : null;
  return (
    <>
      <span className="block font-semibold [overflow-wrap:anywhere]" lang={title.lang} data-language={title.language}>
        {title.text}
      </span>
      {second && second.text !== title.text && (
        <span
          className="block text-sm [overflow-wrap:anywhere]"
          lang={second.lang ?? 'en'}
          data-language={second.language}
        >
          {second.text}
        </span>
      )}
    </>
  );
}
