

## Frequently used commands

### Convert icon to desired size
```sh
magick icon.png -resize 128x128 icon128.png
```

## Convert screenshot to desired size
```sh
magick Screenshot-1.png -resize 1280x800 -background white -gravity center -extent 1280x800 screenshot-1-1280x800.jpg
```

### Zip everything
```sh
zip -r tidy_tabs.zip src manifest.json
```

### Chrome extension console
https://chrome.google.com/webstore/devconsole