#!/bin/zsh
# Dwuklik w Finderze: odpala serwer i otwiera przegladarke.
cd "$(dirname "$0")"
(sleep 1; open http://localhost:4000) &
node serwer.mjs
