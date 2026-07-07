# RaiPlay Sound RSS

<p align="center" width="100%">
    <img width="750" height="525" alt="Example of use in the Podcasts app on Linux" title="Example of use in the GNOME Podcasts app on Linux" src="https://github.com/user-attachments/assets/85f0ef38-ad21-4d03-a35d-86f063e8c3e6" />
</p>

## What is this?

This Fastify service generates always up to date RSS podcast feeds for programs on RaiPlay Sound. It uses their undocumented JSON endpoints instead of vendor-locking you into the tracking circus that RaiPlay Sound is.

Unlike tools that periodically rebuild static feeds, this service is **reactive** and regenerates feeds on demand only when a client requests them, typically when you open your podcast app.

It exposes endpoints structured like:

```
/:type/:name
```

for example:

```
/programmi/battiti
```

> [!NOTE]
> An earlier version of the API required paths structured as `/rss/programmi/battiti.xml`. The structure has been simplified, but the old paths still work.

## Why?

RaiPlay Sound provides:

- structured JSON APIs with full metadata
- direct downloadable audio (MP3)

…but:

- official RSS feeds were abandoned to force you to use their proprietary app
- content is locked behind their web player and tracking-heavy frontend

This service restores open access to that content through standard podcast tools, as was the case until 2020.

## Where do I find the program type and name?

Check on the website:

```
https://www.raiplaysound.it/programmi/battiti
                            ↑ type ↑  ↑ name ↑
```

Works with _programmi_, _audiolibri_, _playlist_... (not _dirette_)

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
http://localhost:3000/programmi/battiti
```

Run it behind a reverse proxy (Caddy, Nginx, etc.) and bind it to localhost.
Do not expose Node's service port directly.

Or, keep reading.

## How it works

1. Fetch program data:

```
https://www.raiplaysound.it/:type/:name.json
```

2. Extract episodes:

- title
- description
- publication date
- metadata

3. Resolve new audio:

- follow either `downloadable_audio.url` or `audio.url`
- extract a stable MP3 url (or MP4 if unavailable) from CDN

4. Cache results:

- avoids re-resolving URLs
- incremental updates only

5. Generate RSS:

- RSS 2.0 + iTunes extensions
- compatible with podcast apps

Highlights:

- Generic endpoint for any program
- Exposes an `/health` endpoint for debugging and a `/stats` endpoint for fun
- Processes queries in a limited concurrent pool so that new shows initialization is fast without flooding the upstream service with hundreds of simultaneous requests
- Rate limits requests so that your server doesn't burn down
- No scraping, no headless browser, no fragile selectors
- No transcoding or storage required

## Limitations

- Depends on RaiPlay Sound’s internal API structure
- MP3 URLs may change over time (handled via cache refresh every week)
- No guarantee of long-term stability (as with any unofficial service, but also official, apparently)

## Legal notice

This project only consumes data and media URLs already exposed by RaiPlay Sound's public frontend. It does not bypass authentication, DRM, or access controls.

## Why did you make this?

I'm approaching my thirties and fall asleep too early to listen to Battiti, but I don't want to lose my edge.

## How long did it take?

Less than writing this.

## But I don't have a server

Check the repository URL. You might find a public instance.
