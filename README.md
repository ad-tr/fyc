# Slide Recorder

Une page web pour enregistrer une présentation : les slides, ta webcam par-dessus, ton micro, et le texte à dire affiché à côté (il n'apparaît pas dans la vidéo).

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
2. Tu passes les slides avec les flèches : le texte de droite suit.
3. `R` arrête. La vidéo (1920x1080, MP4 dans Chrome) se télécharge toute seule.

Reste sur l'onglet pendant l'enregistrement : si tu changes d'onglet, Chrome met l'image en pause.

| Touche | Action |
| --- | --- |
| `←` `→`, Espace, PageUp/PageDown | slide précédente / suivante |
| `R` | enregistrer / arrêter |
| `P` | pause / reprise |
| `C` | afficher / masquer la caméra |
| `T` | afficher / masquer le texte |
| `+` `-` | taille du texte |
| `F` | plein écran |

**Caméra** : glisse-la pour la déplacer (elle se range dans le coin le plus proche), tire un bord ou un coin pour la redimensionner, double-clique pour revenir à la taille par défaut.

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
