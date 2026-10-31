# BZRD — projektowanie ulic w przeglądarce (V2)

Przeglądarkowy odpowiednik [Streetcraft Studio](https://www.streetcraft.studio/), ale bez Adobe Illustratora,
z edycją wektorową jak w Figmie i w polskich standardach (znaki poziome P-1…P-27 wg załącznika nr 2 do
rozporządzenia w sprawie szczegółowych warunków technicznych dla znaków i sygnałów drogowych, szerokości pasów
wg polskich wytycznych).

V2 nie działa już „jak Figma z jedną kolejnością warstw”: **najpierw nawierzchnia, na końcu oznakowanie**,
a co leży na czym decyduje kategoria obiektu, nie ręczne „na wierzch / na spód”.

## Kolejność warstw (stała)

```
0 nawierzchnie   asfalt / chodnik / trawnik / krawężnik (wielokąty)
1 pasy           powierzchnia pasów + automatycznie wypełnione styki pasów
2 przejścia      tło przejść (np. czerwona nawierzchnia P-11)
3 torowiska      podsypka / trawa i podkłady; na jezdni, asfalcie i przejściach → przejazd na jasnych płytach
4 oznakowanie    linie, strzałki, napisy, zebra, szrafura, teksty  — zawsze nad nawierzchnią
5 szyny          nad farbą
6 symbole        pojazdy, ludzie, znaki pionowe, zieleń, mała architektura
```

Wewnątrz kategorii obowiązuje kolejność utworzenia (panel **Warstwy** grupuje obiekty wg kategorii, przeciąganie
zmienia kolejność tylko w jej obrębie). Tory tramwajowe są więc zawsze na wierzchu, a tam, gdzie krzyżują się
z jezdnią, placem asfaltowym lub przejściem, rysują się jako przejazd tramwajowy na płytach.

## Jak to działa

1. **Tło**: pusta plansza, ortofotomapa ESRI World Imagery (wybór obszaru na mapie; skala liczona
   automatycznie) albo własny obraz (skalę kalibrujesz pomiarem).
2. **Krok 1 — Nawierzchnia** (zakładka biblioteki): pasy (pas ruchu, rowerowy, DDR, buspas, torowisko,
   parkowanie, chodnik, zieleń, pas dzielący, separator, pobocze, P-21) i obszary (asfalt, czerwona, chodnik,
   trawnik, krawężnik). Pas to sama nawierzchnia: ustalasz rodzaj, szerokość, kierunek i kolor — bez farby.
   Rysujesz piórem **P**, wielokątem **W**, linią **L**, prostokątem **R**, elipsą **O**; snapowanie
   krawędź-do-krawędzi i śledzenie krawędzi jak w V1.
3. **Łącznik (J)**: kliknij kropkę na końcu jednego pasa, potem kropkę na końcu drugiego — powstaje **osobny
   segment** („Łącznik”) styczny do obu pasów. Pasy nie są scalane ani przycinane; łącznik ma rodzaj
   i nawierzchnię pierwszego pasa, a gdy drugi jest innej szerokości, płynnie się do niego zwęża. Styk dwóch pasów
   pod kątem jest wypełniany automatycznie (zaokrąglenie o szerokości pasa), więc na zewnątrz zakrętu nie brakuje
   asfaltu. Klik kropki, a potem w sam pas = włączenie w bok (klin ze strzałką P-9). Scalanie kawałków w jeden
   obiekt zostało w menu prawego przycisku.
4. **Krok 2 — Oznakowanie (K)**, jak w modzie *Intersection Marking Tool* do Cities: Skylines:
   - rysujesz jak piórem: klik = punkt, przeciągnięcie = przesuwanie mapy, klik w ostatni punkt lub Enter kończy
     linię (narzędzie zostaje włączone), Backspace / Ctrl+Z cofa punkt, Alt+przeciągnięcie = łuk, Shift = 15°;
   - kropki na końcach krawędzi pasów przyciągają punkty (najechanie na krawędź daje punkt w dowolnym jej miejscu):
     - kolejne punkty na **tej samej krawędzi** → linia biegnie po krawędzi między nimi (np. P-2a na ostatnich
       20 m przed skrzyżowaniem, P-1b wcześniej),
     - kolejne punkty na **dwóch różnych krawędziach** → płynny łuk styczny do obu (prowadzenie pasa przez
       skrzyżowanie P-1d / P-1e; przełącznik łuk / prosto w panelu),
     - punkt poza krawędzią → zwykły punkt;
   - przejścia P-10 / P-11 i linie zatrzymania P-12 / P-13 / P-14 rysujesz tak samo, od krawędzi do krawędzi
     w poprzek jezdni;
   - znaki „na pasie” (strzałki P-8a–i, P-9a/b, napis BUS, P-23 rower, stanowiska P-18, szrafura P-21):
     wybierz w bibliotece i **kliknij pas** — znak układa się na osi pasa i powtarza na całej jego długości,
     licząc od końca w kierunku jazdy, domyślnie co 15 m (BUS co 30 m). W panelu pasa zmienisz „Powtarzaj co”
     (szybkie 5 / 10 / 15 / 20 / 30 m) i zakres: cały pas albo tylko N znaków przy końcu; tam też ustawisz linię
     na lewej / prawej krawędzi.
5. **Edycja jak w Figmie**: zaznaczona ścieżka ma uchwyty końców (skracanie / wydłużanie), `Enter` / 2× klik =
   edycja węzłów, prawy przycisk → Przetnij tutaj, grupy Ctrl+G, wspólne wydłużanie kilku pasów.
6. **Zapis**: autozapis w przeglądarce (localStorage / IndexedDB), plik `.bzrd.json` (pliki V1/V2 są migrowane),
   eksport PNG/JPEG w zadanym px/m.

## Znaki poziome — wymiary wg rozporządzenia (odmiany dla V ≤ 70 km/h)

| Znak | Wymiary |
|---|---|
| P-1a / P-1b | 0,12 m; kreska/przerwa 4/8 m (długa, V > 70) · 2/4 m (krótka, miasto) |
| P-1c | 0,24 m; 2/2 m (wydzielająca: buspas, pas rowerowy, pasy włączania) |
| P-1d / P-1e | 1/1 m, 0,12 / 0,24 m (prowadzące przez skrzyżowanie) |
| P-2a / P-2b | ciągła 0,12 / 0,24 m |
| P-3a / P-3b | podwójna, odstęp 0,12 m; przerywana 2/4 (długa) · 1/1 (krótka) |
| P-4 / P-5 | podwójna ciągła · podwójna przerywana 2/4 |
| P-6 | ostrzegawcza 4/2 m |
| P-7a–d | krawędziowe 0,24 (a, b) / 0,12 m (c, d), przerywane 1/1 |
| P-8a…i | strzałki 5,0 m: trzon 0,15 m, grot 2,05 × 0,75 m, groty skrętne 2,5 × 1,05 m — geometria z rys. 3.2.1.2–3.2.1.10 (P-8c = do zawracania, P-8d = w prawo) |
| P-9a / P-9b | naprowadzające 2,9 × 5,0 m |
| P-10 | zebra: pasy 0,5 m co 1,0 m, szerokość 4 m (min. 2,5 m) |
| P-11 | dwa rzędy kwadratów 0,5 m co 1,0 m, szerokość ≥ 1,8 / 3,0 m |
| P-12 / P-13 / P-14 | 0,5 m ciągła · trójkąty 0,5 × 0,7 m co 0,75 m · prostokąty 0,75 × 0,5 m co 1,0 m |
| P-17 | zygzak 1,5 m co 2,5 m, 0,12 m, 30–60 m |
| P-18 | linie 0,12 m z poprzeczkami 0,6 m |
| P-21a | obwiednia P-7b 0,24 m, liniowanie 0,24 m co 0,39 m, skos 1:3 |
| P-22 | BUS 1,62 × 1,60 m |

## Uruchomienie

```bash
npm install
npm run dev
```

Produkcja: `npm run build` → katalog `dist/` (statyczny).

## Skróty

| | |
|---|---|
| V / H / P / W / L / R / O / J / K / T / M | zaznaczanie / rączka / pióro / wielokąt / linia / prostokąt / elipsa / łącznik / oznakowanie / tekst / pomiar |
| Ctrl+C / Ctrl+V / Ctrl+X, Alt+przeciąganie, Shift+przeciąganie | kopiuj / wklej / wytnij, przeciągnij kopię, blokada osi |
| prawy przycisk | menu kontekstowe |
| Enter, Esc | edycja węzłów / zakończ, odznacz (w narzędziach J / K: anuluj pierwszy punkt) |
| Ctrl+Z lub Backspace w trakcie rysowania | usuń ostatni punkt |
| Ctrl+Z / Ctrl+Y, Ctrl+D, Ctrl+A | cofnij / ponów, duplikuj, zaznacz wszystko |
| Ctrl+[ ] (+Shift) | kolejność w obrębie kategorii |
| Ctrl+Shift+L, Ctrl+Shift+H | zablokuj, ukryj |
| Shift+R, Shift+H | obróć symbol o 90°, odbij symbol |
| Shift+1 / Shift+2 / Shift+0, Ctrl+0 | dopasuj planszę / do zaznaczenia / 100% |
| Ctrl+kółko, kółko myszy | zoom pod kursorem (touchpad przewija; tryb w górnym pasku) |
| Spacja+przeciąganie, środkowy przycisk | przesuwanie widoku |

## Struktura

```
src/model      typy (Project v3, StripObj, LineObj, LineSpec, LaneMarking, PathData, RoadSpec, Lane) i stałe jednostek
src/catalog    helpers.ts (kody linii P-1…P-14 z wymiarami, pasy), lanes.ts (pasy), markings.ts (oznakowanie)
src/assets/symbols  biblioteka SVG (pojazdy, ludzie, strzałki P-8/P-9 z pictograms.ts, znaki, zieleń, …)
src/canvas     draw.ts (rysowanie w przebiegach wg kategorii, płyty przejazdu tramwajowego, zaokrąglone styki),
               pictograms.ts (geometria strzałek z rozporządzenia), path.ts (Bézier, offsety), snap.ts, Board.tsx (Konva),
               ObjectNode.tsx (nawierzchnia + obszar trafień jednego obiektu)
src/components start, mapa (Leaflet + ESRI), biblioteka, warstwy wg kategorii, inspektor, pasek narzędzi, eksport
src/store      zustand: projekt, zaznaczenie, historia, viewport, narzędzia (link / mark)
src/lib        geo, persist (autozapis, migracja v1/v2 → v3), export, factory, merge (łącznik, klin, scalanie)
```

Wszystkie wymiary są w **metrach**; ścieżki (`StripObj`/`LineObj`) mają zawsze `rotation = 0`, a Transformer
wypieka skalę i obrót do węzłów. Plansza jest rysowana w kilku warstwach Konva: nawierzchnie (z obszarami
trafień), scena (torowiska, oznakowanie, szyny — jeden kształt), symbole, nakładka edycji.
