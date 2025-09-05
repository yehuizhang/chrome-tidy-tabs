#!/bin/bash

case "$1" in
    build)
      npm run build
      ;;
    lint)
      npm run lint
      ;;
    zip)
      npm run zip
      ;;
    *)
      echo "command is not supported"
      exit 1
      ;;
esac
