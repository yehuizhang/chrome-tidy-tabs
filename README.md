# Tidy Tabs

## Frequently used commands

## Execute test

`node test/*`

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

<https://chrome.google.com/webstore/devconsole>

## Change log

### v1.0.3 [2025-08-09]

* Updated sorting logic so urls are sorted by domain name first then subdomain.
