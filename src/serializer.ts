import { Feed as FeedGenerator } from 'feed'
import type { Feed, Episode, Format } from './types.js'

export { FeedSerializer }

const REPO_URL = 'https://github.com/frammenti/raiplaysoundrss'
const FEED_BASE_URL = 'https://rss.frammenti.dev/'

function escape(value: string): string {
  return value.replace(/\r?\n/g, ' ').trim()
}

class FeedSerializer extends FeedGenerator {
  constructor(data: Readonly<Omit<Feed, 'episodes'>>) {
    super({
      id: data.webpage,
      title: data.title,
      description: data.description,
      link: data.webpage,
      language: data.language,
      image: data.image,
      updated: data.updated,
      generator: REPO_URL,
      feed: FEED_BASE_URL + data.program,
      podcast: true
    })
  }

  add = (ep: Episode) =>
    this.addItem({
      id: ep.id,
      title: ep.title,
      description: ep.description,
      link: ep.webpage,
      date: ep.published,
      enclosure: {
        url: ep.audio,
        type: ep.mime,
        duration: ep.duration
      }
    })

  m3u(): string {
    return [
      '#EXTM3U',
      `#PLAYLIST:${escape(this.options.title)}`,
      `#EXTIMG:${escape(this.options.image!)}`,
      '',
      ...this.items.flatMap(ep => [
        `#EXTINF:${ep.enclosure?.duration ?? -1},${escape(ep.title)}`,
        ep.enclosure!.url,
        ''
      ])
    ].join('\n')
  }

  serialize(format: Format): { body: string; mime: string } {
    switch (format) {
      case 'rss':
        return { body: this.rss2(), mime: 'application/xml' }
      case 'm3u':
        return { body: this.m3u(), mime: 'audio/x-mpegurl' }
    }
  }
}
