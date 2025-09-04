# Y-Nav - Chrome Extension


## Chrome Store page
<https://chromewebstore.google.com/detail/okbadkbpgkcfinhemgigmlooijflihha>

## Features

- [v1.0.0] Manager your tabs: sorting, removing duplicate tabs, and merging multiple windows into one
- [v1.0.3] Quickly search your frequently used pages based on your bookmarks, history, and click counts

## Declaration

* All the data remains in your device. Data will not be send to anywhere, including your other devices. Sync storage may be supported in the future.


## Basic guide

* Use control+shift+B to quickly invoke the extension
* you can use arrow keys to select matches. Tab enter can directly open the first page on the result page if no page was selected

## Development notes

```sh
# Convert icon to desired size
magick icon.png -resize 128x128 icon128.png

# Convert screenshot to desired size
magick Screenshot-1.png -resize 1280x800 -background white -gravity center -extent 1280x800 screenshot-1-1280x800.jpg
```

## Upcoming features

* a reset button that cleans up local storage and reload everything from bookmarks and history
* allow user to exclude certain urls to be added to the local storage.
* allow user to configure max results