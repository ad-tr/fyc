# Slide Recorder

Une page web pour enregistrer une présentation : ta voix, ta webcam et les slides sont enregistrées séparément, puis assemblées dans un écran de montage où tu coupes les passages inutiles avant d'exporter la vidéo. Le texte à dire s'affiche au centre de l'écran, près de la webcam (il n'apparaît pas dans la vidéo).

Le cours **Stablecoins et RWA** est déjà dedans : les 64 slides dans l'ordre et le script de chaque slide. Tu ouvres la page et tout est chargé.

## Lancer

Il faut passer par un petit serveur local (en double-cliquant sur `index.html`, le diapo ne se charge pas tout seul) :

```sh
git clone https://github.com/ad-tr/fyc.git
cd fyc
bunx serve .
```

Puis ouvre l'adresse affichée (par défaut http://localhost:3000) dans **Chrome**, et autorise la caméra et le micro.

## Enregistrer

1. Le décompte démarre avec `R` (ou le bouton Enregistrer).
2. Tu passes les slides avec les flèches : le texte suit. À droite, la slide en cours et le retour de ta webcam.
3. Tu bégayes ? Appuie sur `M` et reprends ta phrase : le passage raté sera proposé à la coupe au montage.
4. `R` arrête et ouvre le montage.

| Touche | Action |
| --- | --- |
| `←` `→`, Espace, PageUp/PageDown | slide précédente / suivante |
| `R` | enregistrer / arrêter |
| `P` | pause / reprise |
| `M` | marquer un raté |
| `C` | caméra enregistrée ou non |
| `T` | afficher / masquer le texte |
| `+` `-` | taille du texte |
| `F` | plein écran |

## Monter

La voix, la caméra et les slides restent séparées jusqu'à l'export : tu peux tout régler après coup.

- **Caméra** : choisis le coin, la taille, ou masque-la. Tu peux aussi la glisser dans l'aperçu. Elle ne recouvre jamais la slide, qui se réduit à côté.
- **Voix** : règle le volume, remplace-la par un fichier retravaillé ailleurs, ou télécharge-la.
- **Couper** : glisse sur la frise pour sélectionner, puis `⌫`. « Trouver les silences » propose les blancs, et chaque `M` propose la phrase ratée. Clic sur une zone hachurée pour la couper, sur une zone rouge pour la remettre. `⌘Z` annule.
- **Exporter la vidéo** : MP4 1920x1080 dans Chrome. L'export se fait en temps réel, garde l'onglet visible.
- **Pistes séparées** : télécharge la caméra, la voix et la chronologie du montage (JSON).

| Touche (montage) | Action |
| --- | --- |
| Espace | lecture / pause |
| `←` `→` (Maj : 5 s) | reculer / avancer d'une seconde |
| `⌫` ou `X` | couper la sélection |
| `⌘Z` | annuler |
| `+` `-` | zoom de la frise |

## Utiliser d'autres slides

Glisse sur la page un PDF ou des images, et éventuellement un script `.md`. Pour changer le diapo chargé au démarrage, remplace le contenu de `slides/` puis lance :

```sh
bun make-manifest.js
```

## Format du script

```md
# Chapitre 1 : Titre du chapitre

## [Diapo 1.1-swift-vs-jeton]
Le texte à dire sur cette slide.

*(Indication de mise en scène.)* Elle s'affiche à part, en gris.
```

- Le nom entre crochets correspond au nom de l'image, sans l'extension et sans le numéro de tête : `[Diapo 1.1-swift-vs-jeton]` va avec `10-1.1-swift-vs-jeton.png`. Les slides sont affichées dans l'ordre du script.
- Avec un PDF, les textes suivent l'ordre des pages.
- Le titre `#` du chapitre s'affiche au-dessus du texte.
