# BZRD — projektowanie ulic w przeglądarce

Przeglądarkowy odpowiednik [Streetcraft Studio](https://www.streetcraft.studio/), ale bez Adobe Illustratora,
z edycją wektorową jak w Figmie i w polskich standardach (znaki poziome P-xx, znaki pionowe A/B/C/D,
szerokości pasów wg polskich wytycznych).

## Jak to działa

1. **Tło**: pusta plansza, ortofotomapa ESRI World Imagery (wybór obszaru na mapie; skala liczona
   automatycznie z poziomu zoomu i szerokości geograficznej) albo własny obraz (skalę kalibrujesz pomiarem).
2. **Biblioteka po lewej**:
   - **Pasy** — jeden obiekt to jeden pas: pas ruchu, rowerowy, DDR, buspas, torowisko, parkowanie, chodnik, zieleń,
     pas dzielący, separator, pobocze. Jezdnię składasz z pojedynczych pasów położonych obok siebie.
   - **Znaki poziome** — linie P-1/P-2/P-3/P-4/P-6/P-7/P-12/P-14, zebra P-10, przejazd P-11, P-17, P-21,
     nawierzchnie (asfalt, czerwona, chodnik, trawnik), krawężnik.
   - **Symbole** — pojazdy, ludzie, strzałki P-8/P-9, znaki punktowe, napisy, znaki pionowe, zieleń, mała architektura.
3. **Rysujesz** wybrany element: pióro **P** (klik = punkt, przeciągnięcie = przesuwanie mapy, Alt+przeciągnięcie = łuk,
   klik w pierwszy punkt zamyka), wielokąt **W**, linia **L**, prostokąt **R**, elipsa **O**.
   Ctrl+Z / Backspace w trakcie rysowania cofa ostatni punkt.
4. **Snapowanie**:
   - pas rysowany przy krawędzi innego pasa ustawia się **krawędź do krawędzi**; gdy kolejne punkty leżą przy tej samej
     krawędzi, nowy pas **biegnie wzdłuż niej** (dokładnie równolegle, także po łuku),
   - wierzchołki obszarów (asfalt, chodnik, trawnik, P-21) przyciągają się do krawędzi i narożników, a brzeg obszaru
     między dwoma punktami na tej samej krawędzi **idzie po tej krawędzi** — tak robisz przejścia i wyokrąglenia nawierzchnią,
   - krawędź, do której przyciąga, podświetla się na czerwono; `Shift` = kąty co 15°; magnes w górnym pasku wyłącza snap,
   - przeciągany obiekt dociąga się krawędzią do krawędzi / węzłów, a dalej do prowadnic innych obiektów,
   - koniec pasa przeciągany uchwytem dociąga się do linii końców sąsiednich pasów.
   - **wyrównanie wzdłuż**: punkt postawiony blisko początku / końca krawędzi sąsiada przeskakuje dokładnie na nie
     (nowy pas zaczyna się i kończy w tym samym miejscu co sąsiad; czerwona linia poprzeczna).
5. **Panel pasa**: rodzaj, szerokość, kierunek ruchu, oznakowanie (strzałki P-8a–h wg polskiego wzoru, w tym
   P-8g zawracanie; rower P-23, BUS, tory, stanowiska, P-21 — zawsze wyśrodkowane i dopasowane do szerokości pasa), nawierzchnia, linia na lewej / prawej krawędzi
   i **Dodaj pas obok** (z lewej / z prawej — nowy pas styka się krawędzią na całej długości).
6. **Edycja jak w Figmie**: zaznaczona ścieżka pokazuje obrys i uchwyty końców (skracanie / wydłużanie wzdłuż osi,
   `Shift` = pełne metry, `Alt` = swobodnie), długość i obrót w panelu; `Enter` / 2× klik = edycja węzłów
   (klik w ścieżkę dodaje węzeł i od razu go chwyta, `Alt` łamie symetrię uchwytów, `Delete` usuwa);
   **prawy przycisk → Przetnij tutaj** rozcina w klikniętym miejscu.
   **Kilka pasów naraz**: zaznacz je (Shift+klik / ramka) albo zgrupuj (**Ctrl+G**, rozgrupuj Ctrl+Shift+G;
   klik zaznacza całą grupę, Ctrl+klik pojedynczy element) i przeciągnij uchwyt końca dowolnego z nich —
   wszystkie wydłużą się / skrócą po tej samej stronie o tyle samo (jeden krok cofania).
7. **Łączenie pasów** — narzędzie **Łącz (J)**: na końcach pasów pojawiają się kropki; kliknij koniec jednego pasa,
   potem koniec drugiego → jeden ciągły pas z płynnym łukiem stycznym do obu (podgląd przed kliknięciem; nachodzące
   końce są lekko przycinane, zawracanie zachowuje długość). Drugi koniec tego samego pasa = zamknięcie w pętlę.
   **Włączenie w bok (klin)**: po kliknięciu kropki końca kliknij w sam pas, do którego ma się włączyć (w miejscu,
   gdzie włączenie ma się skończyć) — krawędź od jego strony przylega do niego, druga schodzi łukiem S,
   pas zwęża się do zera ze strzałką P-9; klin jest grupowany z pasem.
   Kilka kawałków naraz: zaznacz je → prawy przycisk / panel → **Połącz w jeden pas**. Łączy się pas z pasem
   i linię z linią; wynik ma rodzaj i szerokość pierwszego pasa.
8. **Zapis**: autozapis w przeglądarce (localStorage / IndexedDB), plik `.bzrd.json`, eksport PNG/JPEG w zadanym px/m.

## Uruchomienie

```bash
npm install
npm run dev
```

Produkcja: `npm run build` → katalog `dist/` (statyczny).

## Skróty

| | |
|---|---|
| V / H / P / W / L / R / O / J / T / M | zaznaczanie / rączka / pióro / wielokąt / linia / prostokąt / elipsa / łącz pasy / tekst / pomiar |
| Ctrl+C / Ctrl+V / Ctrl+X, Alt+przeciąganie, Shift+przeciąganie | kopiuj / wklej / wytnij, przeciągnij kopię, blokada osi |
| prawy przycisk | menu kontekstowe |
| Enter, Esc | edycja węzłów / zakończ, odznacz |
| Ctrl+Z lub Backspace w trakcie rysowania | usuń ostatni punkt (przesuwanie widoku nie rusza rysowanej linii) |
| Ctrl+Z / Ctrl+Y, Ctrl+D, Ctrl+A | cofnij / ponów, duplikuj, zaznacz wszystko |
| Ctrl+[ ] (+Shift) | kolejność warstw (na spód / na wierzch) |
| Ctrl+Shift+L, Ctrl+Shift+H | zablokuj, ukryj |
| Shift+R, Shift+H | obróć symbol o 90°, odbij symbol |
| Shift+1 / Shift+2 / Shift+0, Ctrl+0 | dopasuj planszę / do zaznaczenia / 100% |
| Ctrl+kółko, kółko myszy | zoom pod kursorem (touchpad przewija; tryb w górnym pasku) |
| Spacja+przeciąganie, środkowy przycisk | przesuwanie widoku |

## Struktura

```
src/model      typy (Project, StripObj, LineObj, PathData, RoadSpec, Lane) i stałe jednostek
src/catalog    presety pasów i znaków, szablony pasów, reguły linii (autoDividers)
src/assets/symbols  biblioteka SVG (132 symbole)
src/canvas     path.ts (Bézier, offsety, podział), draw.ts (Canvas 2D), snap.ts, Board.tsx (Konva), ObjectNode.tsx
src/components start, mapa (Leaflet + ESRI), biblioteka, warstwy, inspektor, pasek narzędzi, eksport
src/store      zustand: projekt, zaznaczenie, historia, viewport, tryb edycji
src/lib        geo (Web Mercator, sklejanie kafelków), persist (autozapis, migracja plików), export, factory
```

Wszystkie wymiary są w **metrach**; ścieżki (`StripObj`/`LineObj`) mają zawsze `rotation = 0`, a Transformer
wypieka skalę i obrót do węzłów.
