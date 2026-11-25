# cards-svg

Generator kart do gry w bridge jako samodzielne dokumenty SVG. Składa się z trzech
kolumn (20% / 60% / 20%):

1. **Kolumna 1** — indeks (ranga nad symbolem koloru) u góry, wyśrodkowany
   w poziomie w swojej kolumnie i w pionie w pasie między krawędzią karty a ramką.
   Ranga jest krojem **bold**, a symbol koloru ma taką samą wysokość jak ranga.
2. **Kolumna 2** — ramka, której ścieżka to dokładnie obrys środkowej kolumny,
   czyli 20% od każdej krawędzi karty (lewej, prawej, górnej i dolnej). Linia
   o grubości 1,5 mm leży symetrycznie na tym obrysie. Domyślnie w środku jeden
   duży symbol pośrodku i cztery mniejsze w rogach (dolne obrócone o 180°).
   W trybie `jumbo` zamiast pięciu symbolów jest jeden, duży, wyśrodkowany i
   dopasowany do wnętrza ramki z zachowaniem proporcji, a w trybie `traditional`
   liczba symboli odpowiada wartości karty.
3. **Kolumna 3** — ten sam indeks co w kolumnie 1, ale na dole i obrócony.

Output zawiera wyłącznie `<path>`, `<rect>` i `<use>` — żadnych `<text>` ani
zależności od fontów, więc karta renderuje się identycznie w każdym narzędziu.

## Użycie

```bash
bun install

# Karta as ♦ na stdout
bun index.ts diamonds A

# Zapis do pliku
bun index.ts diamonds A --out diamond-A.svg

# Warianty
bun index.ts spades A --style outlined --no-pretty
bun index.ts hearts A --color "#B00020"

# Jeden duży symbol w środkowej kolumnie
bun index.ts clubs A --layout jumbo

# Tradycyjne rozmieszczenie pipów dla danej wartości
bun index.ts hearts 9 --layout traditional

# Cała talia do katalogu out/bridge/ lub out/poker/
bun index.ts deck bridge
bun index.ts deck poker

# Pojedyncza karta w rozmiarze wybranej talii
bun index.ts spades K --deck poker
```

Nazwy kolorów działają w liczbie pojedynczej i mnogiej (`diamond` / `diamonds`).
Domyślnie generowana jest as ♦, więc samo `bun index.ts` też daje A♦.

### Flagi

| Opcja                      | Domyślnie       | Opis                                                                         |
| -------------------------- | --------------- | ---------------------------------------------------------------------------- |
| `<suit>`                   | `diamonds`      | `spades` \| `hearts` \| `diamonds` \| `clubs` (kolejność brydżowa)           |
| `<rank>`                   | `A`             | `A` `K` `Q` `J` `10` `9` `8` `7` `6` `5` `4` `3` `2`                         |
| `--style`                  | `solid`         | `solid` (♦) albo `outlined` (♢)                                              |
| `--layout`                 | `standard`      | `standard` (5 symboli), `jumbo` (jeden duży) albo `traditional` (wzór rangi) |
| `--deck`                   | —               | Rozmiar i układ z presetu talii: `bridge` albo `poker`                       |
| `--color`                  | czerwony/czarny | Nadpisanie koloru karty, np. `#C8102E`                                       |
| `--out`                    | stdout          | Ścieżka zapisu SVG                                                           |
| `--pretty` / `--no-pretty` | `--pretty`      | Formatowanie wieloliniowe albo jedna linia                                   |

### Komenda `deck`

```bash
bun index.ts deck <bridge|poker> [--out-dir out]
```

Zapisuje wszystkie 52 karty jako osobne pliki SVG w `<out-dir>/<deck>/`.

| Preset   | Rozmiar karty | Układ środkowej kolumny    | Katalog       |
| -------- | ------------- | -------------------------- | ------------- |
| `bridge` | 57 × 89 mm    | `traditional` (wzór rangi) | `out/bridge/` |
| `poker`  | 63 × 88 mm    | `jumbo` (1 duży symbol)    | `out/poker/`  |

Nazwy plików to `<suit>-<rank>.svg`, na przykład `spades-A.svg` czy `hearts-10.svg`.

## Biblioteka

```ts
import { renderCard } from "./src/index.ts";

const svg = renderCard({ suit: "diamonds", rank: "A" });
```

`renderCard()` przyjmuje `CardSpec` (`suit`, `rank`, `style`, `layout`, `size`,
`color`, `pretty`) i zwraca gotowy dokument SVG.

Tabelę tradycyjnych wzorów eksportuje `src/pips.ts`: `PIP_LAYOUTS[rangi]` to
pozycje znormalizowane do pola pipów (`fx`/`fy` od 0 do 1), więc ten sam wzór
działa dla każdego rozmiaru karty. Jednostki `viewBox` to 0,1 mm,
więc karta 57 × 89 mm ma viewBox `0 0 570 890`.

Całą talię renderuje `renderDeck(DECKS.poker)` (bez zapisu na dysk) albo
`writeDeck(DECKS.poker, "out")`. Geometrię dowolnego rozmiaru zwraca
`cardGeometry({ widthMm: 63, heightMm: 88 })`.

Układ kolumn i ramki jest liczony w procentach karty, więc działa dla każdego
rozmiaru. Elementy rysowane (glify, grubość linii, promienie rogów) mają stały
rozmiar w milimetrach — dzięki temu talia bridge i poker wyglądają jak ten sam
krój, tylko w innym formacie.

## Symbole kolorów

| Kolor (kolejność brydżowa) | Pełny | Pełny Unicode | Obrysowany | Obrysowany Unicode |
| -------------------------- | ----- | ------------- | ---------- | ------------------ |
| ♠ Piki                     | ♠     | U+2660        | ♤          | U+2664             |
| ♥ Kier                     | ♥     | U+2665        | ♡          | U+2661             |
| ♦ Karo                     | ♦     | U+2666        | ♢          | U+2662             |
| ♣ Trefl                    | ♣     | U+2663        | ♧          | U+2667             |

## Wektory glifów

`src/glyphs.ts` jest **generowany** i zawiera już zawektoryzowane kształty symboli
oraz rangi. Regeneracja (wymaga `inkscape` i fontconfig, tylko na maszynie deweloperskiej):

```bash
bun run glyphs                 # domyślnie font FreeSans
bun run glyphs -- --font "DejaVu Sans"
```

Sam generator kart nie potrzebuje Inkscape ani sieci.

## Budowa dokumentu SVG

Każdy kształt jest deklarowany w `<defs>` dokładnie raz i cytowany przez `<use>`:

```
<defs>
  <path id="pip" .../>      <- kształt koloru, jedna ścieżka
  <path id="rank" .../>     <- kształt rangi
  <g id="index">            <- ranga + kolor, wyśrodkowane w (0,0)
</defs>
<rect .../>                 <- tło karty
<g fill="...">              <- środkowa kolumna: ramka + pipy
<use href="#index" .../>    <- kolumna 1
<use href="#index" rotate(180)/>  <- kolumna 3
```

Dzięki temu karta A♣ ma ~1,8 KB zamiast ~4,5 KB, a pozycjonowanie to sam
`transform` — bez powtarzania danych ścieżek.

## Development

```bash
bun run typecheck   # bun check
bun test            # 127 testów: geometria, glify, pipy, SVG, render, talie, CLI
```

## Tradycyjne rozmieszczenie pipów

`--layout traditional` rysuje w środkowej kolumnie tyle symboli, ile wynosi
wartość karty, zgodnie z konwencją zwykłej talii:

| Ranga | Wzór                                          |
| ----- | --------------------------------------------- |
| `2`   | dwa symbole w kolumnie środkowej              |
| `3`   | trzy symbole w kolumnie środkowej             |
| `4`   | dwa rzędy po dwa symbole                      |
| `5`   | cztery narożne plus jeden w środku            |
| `6`   | trzy rzędy po dwa symbole                     |
| `7`   | sześć narożnych plus jeden w górnej połowie   |
| `8`   | sześć narożnych plus dwa w kolumnie środkowej |
| `9`   | cztery rzędy po dwa plus jeden w środku       |
| `10`  | osiem narożnych plus dwa w kolumnie środkowej |

Dolna połowa wzoru jest obrócona o 180°, a asa i figur wzór nie dotyczy — dla
nich `traditional` rysuje układ `standard`. Wszystkie rangi używają jednego
rozmiaru symbolu, liczonego z najgęstszego wzoru (9 i 10), więc pipy nigdy się
nie stykają.

## Ograniczenia

- Figury (K, Q, J) mają w środkowej kolumnie jeden duży symbol — tradycyjne
  rozmieszczenie pipów dotyczy rang 2–10.
- Brak marginesów druku i znaczników cięcia — karta jest czystym konturem.
