export type {
  Feed,
  Episode,
  Format,
  ProgramType,
  Cache,
  CachedEpisode,
  Stats,
  ProgramItem,
  PlaylistItem,
  EpisodeItem
}

type Format = 'rss' | 'm3u'
type ProgramType = 'programmi' | 'audiolibri' | 'playlist'

interface Feed {
  program: string
  title: string
  description: string
  language: string
  image: string
  webpage: string
  updated: Date
  episodes: Episode[]
}

interface Episode {
  id: string
  title: string
  description: string
  webpage: string
  published: Date
  audio: string
  mime: string
  duration?: number
}

/*
-------------------------------------------------------------------------------
Cache
-------------------------------------------------------------------------------
*/
interface CachedEpisode {
  mp3: string
  date: Date
  resolvedAt: number
}

type Cache = Map<string, CachedEpisode>

/*
-------------------------------------------------------------------------------
Stats
-------------------------------------------------------------------------------
*/
type Stats = Record<string, number>

/*
-------------------------------------------------------------------------------
RAI
-------------------------------------------------------------------------------
*/
type ContentType = 'episodi' | 'playlist singola' | 'playlist'

interface ProgramItem {
  podcast_info: {
    title: string
    description: string
    weblink: string
    image: string
  }

  tab_menu: {
    content_type: ContentType
    path_id: string
    active: boolean
  }[]

  block: EpisodeBlock | PlaylistContainerBlock
}

interface PlaylistContainerBlock {
  content_type: Extract<ContentType, 'playlist'>
  cards: PlaylistItem[]
}

interface EpisodeBlock {
  content_type: Exclude<ContentType, 'playlist'>
  cards: EpisodeItem[]
}

interface PlaylistItem {
  title: string
  path_id: string
}

interface EpisodeItem {
  uniquename: string
  title: string
  episode_title?: string
  description: string
  weblink: string
  audio: Audio
  downloadable_audio?: Audio
  duration_small_format: string
  track_info: {
    date: string
    episode_number: `${number}`
  }
  create_time: string
}

interface Audio {
  url: string
  duration?: string
}
