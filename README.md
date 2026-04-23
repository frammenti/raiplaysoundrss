# RaiPlay Sound RSS

## What is this?

This tiny Fastify instance generates perfect RSS podcast feeds for programs on RaiPlay Sound by using their undocumented JSON endpoints instead of vendor-locking you into the tracking circus that RaiPlay Sound is.

It exposes endpoints structured like:

```
/rss/:program.xml
```

for example:

```
/rss/battiti.xml
```

## Where do I find the program name?

```
https://www.raiplaysound.it/programmi/battiti
                                      ↑ here ↑
```

## What do I need to make this work?

A Node.js server, the base for all greatness.

```bash
git clone https://github.com/frammenti/raiplaysoundrss
cd raiplaysoundrss
npm install
npm run build
npm run start
```

Then open:

```
http://localhost:3000/rss/battiti.xml
```

Run it behind a reverse proxy (Caddy, Nginx, etc.) and bind it to localhost.
Do not expose the service port directly.

Or, keep reading.

## Why?

RaiPlay Sound provides:

- structured JSON APIs with full metadata
- direct downloadable audio (MP3)

…but:

- official RSS feeds were abandoned to force you to use their proprietary app
- content is locked behind their web player and tracking-heavy frontend

This service restores a simple, open, and standard way to access that content.

## How it works

1. Fetch program data:

```
/programmi/:program.json
```

2. Extract episodes:

- title
- description
- publication date
- metadata

3. Resolve audio:

- follow `downloadable_audio.url`
- extract final MP3 from CDN

4. Cache results:

- avoids re-resolving URLs
- incremental updates only

5. Generate RSS:

- RSS 2.0 + iTunes extensions
- compatible with podcast apps and feed readers

## What it does right

- Resolves CDN queries for stable media urls
- Incremental updates (only processes new episodes)
- Persistent cache (no network overhead)
- Generic endpoint for any program
- No scraping, no headless browser, no fragile selectors
- No transcoding or storage required
- Exposes an `/health` endpoint
- Rate limits requests so that your server doesn't burn down
- Fast and lightweight

## Is this hacking?

This project does not “hack” anything.
It simply uses the same data sources exposed by the frontend, but without the unnecessary complexity, tracking, and artificially imposed restrictions.

## Limitations

- Depends on RaiPlay Sound’s internal API structure
- MP3 URLs may change over time (handled via cache refresh every week)
- No guarantee of long-term stability (as with any unofficial service, but also official, apparently)

## Why did you make this?

I'm approaching my thirties and fall asleep too early to listen to Battiti, but I don't want to lose my edge.

## How long did it take?

Less than writing this.

## But I don't have a server

Check the repository URL. You might find a public instance.
