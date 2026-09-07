# StudioBoard

Modulärt 3-appssystem för digital anslagstavla, aktivitetsregistrering och administration.

## GitHub Pages placering

Lägg hela denna mapp i ditt repo så här:

```text
lynoit.github.io/
└── StudioBoard/
    ├── index.html
    ├── dashboard/
    ├── activity/
    ├── admin/
    ├── customers/
    └── assets/
```

## URL:er för Skröja

```text
https://lynoit.github.io/StudioBoard/
https://lynoit.github.io/StudioBoard/dashboard/?customer=skroja
https://lynoit.github.io/StudioBoard/activity/?customer=skroja
https://lynoit.github.io/StudioBoard/admin/?customer=skroja
```

## Struktur

```text
StudioBoard/
├── index.html
├── dashboard/
│   ├── index.html
│   └── core/
├── activity/
│   ├── index.html
│   └── core/
├── admin/
│   ├── index.html
│   └── core/
├── customers/
│   ├── skroja/
│   │   ├── config.js
│   │   └── skroja-logo.png
│   └── _template/
│       └── config.js
└── assets/
    ├── cork.jpg
    ├── wood.jpg
    └── Lynoit_logo_plate_rusty_2.png
```

## Ny kund

1. Kopiera `customers/_template/` till `customers/<kund-id>/`.
2. Ändra endast `customers/<kund-id>/config.js`.
3. Lägg kundens logga i kundmappen.
4. Öppna apparna med `?customer=<kund-id>`.

Core-koden ska normalt inte ändras per kund.
