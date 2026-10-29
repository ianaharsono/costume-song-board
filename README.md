# Costume Song Board

Tap a costume character to open its song in Spotify. On a phone with the Spotify app installed, songs open straight in the app.

Live page: https://ianaharsono.github.io/costume-song-board/

## Adding or changing characters

Edit `characters.json`. Each character looks like this:

```json
{
  "name": "Elmo",
  "songName": "Elmo's World",
  "spotify": "https://open.spotify.com/track/2RugYIdiYG7dl5cE4zS6fh",
  "tags": ["monster", "muppet"],
  "order": 0,
  "photo": "photos/elmo.jpg"
}
```

- `spotify`: in Spotify, tap ••• on a song, then Share, then Copy link.
- `photo`: put your own costume photo in the `photos` folder and add its path here. Leave it empty to show the first letter instead.
- `order`: lower numbers show first when the board is sorted by "My order".
