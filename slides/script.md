<!--
Script du cours Stablecoins et RWA, pour Slide Recorder.
Format :
  # Titre de chapitre          -> affiché au-dessus du texte
  ## [Diapo nom-de-la-slide]   -> texte de la slide slides/NN-nom-de-la-slide.png
  *(indication)*               -> didascalie, affichée à part
-->

# Introduction (1 min · slides 1 à 2)

## [Diapo intro-attente]
Vendredi, 16 heures. Une PME lyonnaise vire 40 000 euros à son fournisseur au Vietnam. L'argent arrive… le mardi. Trois banques sur le trajet, trois fois des frais. Ce même vendredi, des stablecoins traversent la planète en quelques secondes. Et un dimanche à 3 heures du matin, ce serait pareil.

## [Diapo intro-carte-du-cours]
Ce cours vous montre ce qu'il y a sous la surface. Regardez l'iceberg : en haut, un euro qui circule en quelques secondes. Dessous, le code, l'architecture, la preuve de réserves et la conformité. Notre fil rouge, c'est Kéa Finance, une fintech fictive qui veut lancer le Keo, un stablecoin en euro. Et à la fin, vous coderez le vôtre, dans votre navigateur. Bon. Le chapitre 0 rappelle les bases. Si vous les connaissez, rendez-vous directement à la slide 9.


# Chapitre 0 : Prérequis et mise à niveau express (5 min · slides 3 à 8)

## [Diapo 0.0-titre]
Si vous savez déjà ce qu'est une adresse, une clé privée et le *gas*, passez directement à la slide 9. Pour les autres, bienvenue. En cinq minutes, je vous donne le strict minimum pour suivre le cours : une blockchain, des clés, une transaction, et la différence entre Bitcoin et Ethereum. Et à la fin, les trois briques de code qu'il faut savoir lire, parce que dans ce cours, vous allez coder.

## [Diapo 0.1-registre-partage]
Commençons par le registre. Aujourd'hui, votre solde bancaire, c'est une ligne dans le registre de votre banque. Vous lui faites confiance, et personne d'autre ne peut vérifier. Une blockchain, c'est un registre copié chez des milliers d'ordinateurs, qu'on appelle des nœuds. Regardez le schéma : chacun a la même copie. Quand une opération arrive, chacun la vérifie. Les opérations sont regroupées en blocs, et chaque bloc contient l'empreinte du précédent. Si quelqu'un modifie une vieille ligne, l'empreinte change, et tout le monde le voit. Résultat : personne ne contrôle le registre seul. Ni une banque, ni un État, ni moi.

## [Diapo 0.2-cles-adresse]
Maintenant, les clés. Sur une blockchain, pas d'IBAN : vous avez une adresse, une suite de caractères qui commence par « 0x » sur Ethereum. Vous la donnez pour recevoir des fonds. Derrière, il y a une clé privée, un très grand nombre secret. De la clé privée, on calcule la clé publique, puis l'adresse. Et le calcul ne marche que dans un sens. Avec l'adresse, impossible de retrouver la clé. Donc, qui a la clé a les fonds. Si vous la perdez, il n'y a pas de bouton « mot de passe oublié ». Dernier mot : le portefeuille, ou *wallet*. C'est le logiciel qui garde vos clés. Il ne contient pas vos jetons : eux, ils sont dans le registre.

## [Diapo 0.3-transaction]
Alors, qu'est-ce qui se passe quand Alice envoie 100 Keo à Bob ? Elle signe un message avec sa clé privée : c'est la transaction. Les nœuds vérifient la signature et le solde. La transaction entre dans un bloc, toutes les 12 secondes environ sur Ethereum. Et le registre change : Alice moins 100, Bob plus 100. Tout ce calcul a un prix : le *gas*. Un simple envoi d'ether consomme 21 000 unités de *gas*. Ces frais se paient en ether, et leur prix monte quand le réseau est encombré. Piège classique : même pour envoyer des Keo, Alice a besoin d'un peu d'ether.

## [Diapo 0.4-bitcoin-ethereum]
Dernière notion : Bitcoin et Ethereum. Bitcoin, lancé en 2009, tient le registre d'un seul actif, le bitcoin. Un bloc toutes les dix minutes environ, et un langage volontairement limité. Ethereum, lancé en 2015, ajoute une idée décisive : déposer des programmes sur la blockchain. On les appelle des smart contracts. Un stablecoin, c'est exactement ça : un programme qui tient les soldes et fixe les règles. L'USDC, BUIDL et EURCV sont nés sur Ethereum, et le Keo y naîtra aussi. Voilà ce qu'on veut dire par « programmable », et voilà pourquoi ce cours parle d'Ethereum.

## [Diapo 0.5-lire-du-code]
Dernier prérequis, et il compte, parce que dans ce cours, vous allez coder. Pas de panique : trois briques suffisent pour démarrer. Regardez ce petit contrat. C'est une tirelire, écrite en Solidity, le langage d'Ethereum. En haut, une variable : solde. C'est un nombre, gardé sur la blockchain. Ensuite, deux fonctions : déposer et retirer. Ce sont les actions qu'on peut appeler, avec un montant. Et dans retirer, il y a une condition : require. Si vous voulez retirer plus que le solde, toute la transaction est annulée. Rien ne bouge. Variable, fonction, condition : c'est tout ce qu'il vous faut. Un stablecoin, c'est la même chose en plus grand : une table de soldes, des fonctions pour envoyer, créer et détruire, et des conditions qui disent qui a le droit de quoi. Vous êtes prêt. Dans le chapitre 1, on passe aux choses sérieuses : pourquoi la finance veut tokeniser ses actifs.


# Chapitre 1 : Pourquoi tokeniser des actifs ? (4 min · slides 9 à 14)

## [Diapo 1.0-titre]
Chapitre 1 : pourquoi tokeniser des actifs ? Repartons de Kéa Finance. Ses clients sont des PME qui achètent et vendent à l'étranger. Leur problème : un paiement international met parfois plusieurs jours, et il coûte cher. Voyons d'où ça vient, et ce qu'un jeton peut y changer.

## [Diapo 1.1-swift-vs-jeton]
Regardez le haut du schéma. Un virement international passe par SWIFT. Attention : SWIFT transporte des messages, pas l'argent. L'argent, lui, saute de banque en banque : la banque d'Alice, une ou deux banques correspondantes, puis celle de Bob. Chacune vérifie, chacune facture. Pour les titres, c'est pareil : chaque intermédiaire tient son registre. Le règlement-livraison, le moment où le titre et l'argent changent vraiment de mains, prend un jour aux États-Unis depuis mai 2024. En Europe, deux jours, jusqu'en octobre 2027. Et soyons justes : d'après SWIFT, 90 % des paiements atteignent la banque du bénéficiaire en moins d'une heure. Mais seulement 43 % arrivent dans l'heure sur le compte du client final.

## [Diapo 1.2-apports]
Et avec un jeton, qu'est-ce qui change ? Quatre choses. Un : un seul registre, le même pour tous, donc plus rien à rapprocher. Deux : il ne ferme jamais. Un bloc toutes les 12 secondes, même à Noël. Trois : si le titre et l'argent sont tous deux des jetons, ils changent de mains dans la même transaction, ou pas du tout. Quatre : les règles sont inscrites dans le jeton. Et retenez ceci : pour régler un titre sur la blockchain, il faut de l'argent sur la blockchain. D'où les stablecoins.

## [Diapo 1.3-jeton-droit-actif]
Alors, qu'est-ce qu'un RWA ? Un actif du monde réel : des euros, une obligation, une part de fonds, un immeuble. Tokeniser, c'est créer un jeton qui donne droit à cet actif. Et voici le point clé : le jeton, seul, ne vaut rien. Il vaut par le contrat qui le relie à l'actif. Prenez 100 Keo. Ils valent 100 euros parce que Kéa s'engage à les racheter au pair, avec des euros déposés à la Banque Sorel. Sans ce contrat, le Keo n'est qu'une ligne dans un tableur. Très bien sécurisé, certes.

## [Diapo 1.4-trois-exemples]
Trois exemples réels vont nous suivre. D'abord l'USDC : un stablecoin en dollar lancé en 2018, émis par Circle, avec 73,3 milliards de dollars en circulation fin juin 2026. Ensuite BUIDL, le premier fonds tokenisé de BlackRock, lancé sur Ethereum en mars 2024 et placé en bons du Trésor américain. C'est Securitize qui tient son registre. Enfin SG-Forge, la filiale de Société Générale : des obligations en jetons dès 2019, puis EURCV, un stablecoin en euro, devenu en 2024 un jeton de monnaie électronique au sens de MiCA. C'est le statut que vise Kéa.

## [Diapo 1.5-promesses-realite]
Promesses et réalité, maintenant. La promesse : un règlement en quelques secondes, 24 heures sur 24, avec moins d'intermédiaires. La réalité : BUIDL ne circule qu'entre investisseurs approuvés. Le fonds est éclaté sur neuf blockchains. L'argent reste souvent hors chaîne. Et un immeuble tokenisé reste un immeuble. Je ne dis pas que c'est une bulle. Je dis que ça avance d'abord là où l'actif est simple : la monnaie. Justement, dans le chapitre 2, nous allons voir ce qu'est vraiment un stablecoin.


# Chapitre 2 : Comprendre un stablecoin (5 min · slides 15 à 21)

## [Diapo 2.0-titre]
Bon. Kéa veut que ses PME paient leurs fournisseurs en quelques secondes. Un jeton sait aller vite, on l'a vu. Mais il lui manque une chose : garder sa valeur. C'est le sujet du chapitre.

## [Diapo 2.1-definition]
Un stablecoin, c'est un jeton conçu pour garder une valeur fixe. Presque toujours un dollar, parfois un euro.

Pourquoi en a-t-on besoin ? Imaginez qu'Alice paie une facture de 100 € en ether. Le temps que son fournisseur convertisse, l'ether a bougé. Impossible de tenir une comptabilité comme ça.

Avec un stablecoin, 100 Keo envoyés le matin valent encore 100 € le soir.

Mais attention. Cette stabilité n'est pas dans le code. La stabilité, c'est une promesse. Et quand la promesse lâche, le prix décroche : c'est le décrochage, le *depeg* en anglais.

Alors, qu'est-ce qui tient la promesse ? Il y a trois réponses.

## [Diapo 2.2-familles]
Regardez ces trois colonnes.

À gauche, la famille la plus simple : adossé à la monnaie. Pour chaque jeton, un euro ou un dollar attend en réserve, à la banque ou en titres d'État. Vous rendez le jeton, on vous rend votre euro, au pair. C'est USDC chez Circle, EURC, ou EURCV chez Société Générale. Et c'est le choix de Kéa.

Au milieu : adossé aux cryptos. On bloque de l'ether en garantie, et on bloque plus qu'on ne crée. Par exemple, 150 dollars d'ether pour 100 DAI. Si l'ether chute, le protocole vend la garantie. C'est DAI, et son successeur USDS, chez Sky.

À droite : algorithmique. Pas de réserve. Juste un algorithme et un deuxième jeton. Et ça, ça mérite une histoire.

## [Diapo 2.2-terra]
TerraUSD, ou UST. Le principe : un UST pouvait toujours être échangé contre un dollar de LUNA, son jeton frère. Si l'UST passait sous le dollar, on le rendait contre du LUNA, l'offre baissait, le prix remontait. Sur le papier.

Ajoutez un protocole, Anchor, qui annonçait jusqu'à 20 % d'intérêt. Début mai 2022, l'UST pèse plus de 18 milliards de dollars.

Le lundi 9 mai, il passe nettement sous le dollar. Tout le monde rend ses UST. Chaque UST rendu crée du LUNA. Le LUNA s'effondre, et la panique redouble. En quelques jours, il circule plus de 6 500 milliards de LUNA, et la blockchain Terra est arrêtée.

Bilan : plus de 40 milliards de dollars de pertes pour les investisseurs, selon le parquet de New York. Son cofondateur, Do Kwon, a été condamné à 15 ans de prison en décembre 2025.

Mon avis ? Un jeton garanti par un autre jeton de la même équipe, ce n'est pas une monnaie. C'est un pari.

## [Diapo 2.3-acteurs]
Qui fait tenir la promesse ? Cinq acteurs.

L'émetteur crée et détruit les jetons, et s'engage à les racheter au pair. C'est Kéa.

La banque garde les euros, sur des comptes séparés. Si Kéa fait faillite, ces euros reviennent aux porteurs. Ici, la Banque Sorel.

La blockchain tient le registre et exécute le smart contract. Elle ne connaît que des adresses et des montants.

Les intermédiaires, plateformes d'échange et portefeuilles, font circuler le jeton.

Et les utilisateurs : Alice, la Boutique.

Un maillon casse, la promesse casse.

## [Diapo 2.4-mint]
Maintenant, suivons 100 €.

Alice vire 100 € sur le compte de réserve de Kéa, à la Banque Sorel. Kéa voit les fonds arriver. Alors, et seulement alors, Kéa envoie une transaction : mint, Alice, 100. C'est la création, le *mint*.

Le portefeuille d'Alice affiche 100 Keo. L'offre totale monte de 100.

Regardez l'ordre : l'euro arrive d'abord, le jeton naît ensuite.

## [Diapo 2.4-burn]
Et le chemin retour. Alice veut récupérer ses euros. Elle envoie ses 100 Keo à l'adresse de Kéa. Kéa appelle burn, 100 : c'est la destruction, le *burn*. Puis la Banque Sorel vire 100 € à Alice.

Cette fois, le jeton meurt d'abord, l'euro part ensuite. Dans les deux sens, l'ordre protège le porteur.

Et retenez la règle, elle ne bouge jamais : jetons en circulation égale euros en réserve. 100 et 100. Puis 0 et 0. Si Kéa a émis deux millions de Keo, il doit y avoir deux millions d'euros à la banque.

Mais ce mint, ce burn, c'est quoi exactement ? Du code, que vous allez écrire. On l'ouvre dans le prochain chapitre.


# Chapitre 3 : Le standard ERC-20 pas à pas (7 min · slides 22 à 32)

## [Diapo 3.0-titre]
Bon. On a dit : « Kéa appelle mint ». Mais appeler quoi, exactement ? Ce contrat, vous l'écrirez vous-même dans le cas pratique. Alors je vous explique chaque ligne.

## [Diapo 3.1-smart-contract]
Dans une banque, c'est la banque qui applique la règle : pas de virement si le compte est vide.

Sur Ethereum, il n'y a pas de banque. Alors qui applique la règle ? Un smart contract. En français, « contrat intelligent », mais presque personne ne dit ça.

C'est un programme stocké sur la blockchain, à une adresse fixe. Alice signe une transaction vers le contrat. Le contrat vérifie : le solde suffit ? Si oui, le registre change. Sinon, rien ne bouge.

Ni contrat, ni intelligent, donc. Un automate.

Retenez : lire est gratuit, écrire coûte une transaction et du *gas*.

## [Diapo 3.2-standard]
Imaginez que chaque émetteur invente ses noms de fonctions : chaque portefeuille devrait s'adapter à chaque jeton. Le Keo ne serait accepté nulle part.

D'où ERC-20. C'est l'EIP-20, une proposition datée de novembre 2015, signée Fabian Vogelsteller et Vitalik Buterin. Elle fixe une interface : six fonctions obligatoires, avec leurs noms exacts. Plus deux événements, Transfer et Approval.

Respectez cette liste, et tous les portefeuilles vous comprennent d'office. C'est une prise électrique normalisée.

## [Diapo 3.3-lecture]
Commençons par lire. Trois fonctions, fournies par OpenZeppelin, que vous appellerez sans arrêt.

totalSupply : l'offre totale, tous les jetons qui existent.

balanceOf, surlignée : on lui donne une adresse, elle renvoie son solde.

decimals : combien de chiffres après la virgule.

Le mot important, c'est view : lecture seule, pas de transaction, pas de frais. Et returns uint256 : la réponse est un entier positif, sans virgule.

Justement, Solidity ne connaît pas les virgules. USDC a 6 décimales : 100 USDC, pour le contrat, c'est 100 millions. Votre Keo en aura 18, la valeur par défaut.

## [Diapo 3.4-transfer]
Envoyer, maintenant. La fonction transfer prend deux choses : le destinataire, to, et le montant, value.

Vous remarquez ce qui manque ? L'expéditeur. C'est forcément celui qui signe : personne ne peut envoyer vos jetons à votre place.

Pas de view : il faut une transaction et du *gas*. Solde insuffisant ? Tout échoue.

En dessous, l'événement Transfer : qui envoie, qui reçoit, combien. C'est un message pour l'extérieur : les portefeuilles l'écoutent.

## [Diapo 3.4-registre]
Regardez ce schéma. Avant : Alice a 150, Bob 50, Kéa 800. Alice appelle transfer, Bob, 30. Après : Alice 120, Bob 80.

Et l'offre totale ? 1 000 avant, 1 000 après. Un transfert déplace des jetons, il n'en crée aucun.

## [Diapo 3.5-approve]
Deuxième situation : une appli de paiement doit débiter Alice à la livraison, sans avoir sa clé privée. transfer ne marche pas.

On fait ça en deux temps. Un : Alice appelle approve, Appli, 50. Elle accorde une autorisation, une *allowance*, de 50. Aucun jeton ne bouge.

Deux : à la livraison, l'appli appelle transferFrom, d'Alice vers la Boutique, 30. Le contrat vérifie, déplace 30 Keo, et l'autorisation tombe à 20.

Approuvé ne veut pas dire payé. Mais ça veut dire payable.

## [Diapo 3.5-risques]
Et ça cache deux risques.

À gauche, l'autorisation illimitée. Beaucoup d'applis demandent le maximum, une fois pour toutes. Mais si l'appli est piratée, tout votre solde peut partir. Mon conseil : approuvez le montant exact, et révoquez ce qui ne sert plus.

À droite, le problème connu d'approve. Alice veut passer de 50 à 20. Une appli malveillante voit la transaction en attente, dépense vite les 50, puis les 20 nouveaux. 70 au lieu de 20. La parade de l'EIP-20 : repasser d'abord l'autorisation à zéro.

## [Diapo 3.6-keo]
Et mint, et burn ? Surprise : ils ne font pas partie du standard. ERC-20 dit comment un jeton circule, pas qui l'émet. C'est vous qui allez les ajouter.

Voici le contrat Keo, celui que vous allez taper. Lignes 2 et 3 : vous importez deux briques d'OpenZeppelin, une bibliothèque de contrats audités. ERC20, tout le standard déjà écrit. Ownable, la notion de propriétaire.

Ligne 5 : Keo hérite des deux. Il sait déjà faire transfer et approve.

Ligne 7 : le constructeur. Nom Keo, symbole KEO. Et Ownable de msg.sender : celui qui déploie, donc Kéa, devient propriétaire.

Ligne 8 : mint, avec onlyOwner. Si ce n'est pas Kéa qui appelle, ça échoue. Ligne 11 : burn, sur les jetons que Kéa a récupérés.

Regardez les commentaires : _mint émet un Transfer depuis l'adresse zéro, _burn un Transfer vers elle. Zéro, c'est personne. Depuis zéro : créé. Vers zéro : détruit.

## [Diapo 3.7-etherscan]
Assez de théorie. On ouvre un vrai contrat : USDC, sur Etherscan.

*(Page Circle « USDC contract addresses ».)* L'adresse, je la prends chez Circle, jamais dans un moteur de recherche. Ligne Ethereum : 0xA0b8, qui finit par eB48. Je la colle dans Etherscan.

*(Onglet Contract.)* Le contrat s'appelle FiatTokenProxy. Un proxy, c'est une adresse fixe qui renvoie vers un code que Circle peut remplacer. Donc les fonctions du jeton sont dans Read as Proxy, pas dans Read Contract.

*(Read as Proxy.)* decimals : 6. totalSupply : un nombre énorme. Divisez par un million. Le 20 octobre 2026, j'ai lu environ 47,8 milliards d'USDC sur Ethereum.

*(Onglet Events.)* Ici, des Transfer : from, to, value. Je copie une adresse « to ».

*(Read as Proxy, balanceOf, Query.)* Je la colle dans balanceOf. Voilà son solde, en direct.

## [Diapo 3.7-a-vous]
À vous, maintenant. Ouvrez remix.ethereum.org : rien à installer.

Créez un fichier Keo.sol et collez-y le contrat. Remix va chercher OpenZeppelin tout seul. Compilez. Dans Deploy & Run Transactions, choisissez la Remix VM, une blockchain de test avec dix comptes, et cliquez sur Deploy.

Appelez mint avec votre adresse et 100e18 : 100 Keo. Puis transfer de 30e18 vers un autre compte. Vérifiez les deux soldes avec balanceOf. Et dans le terminal, dépliez la transaction : votre événement Transfer est là.

Ce que vous venez de faire, le back-office de Kéa le fera en permanence. C'est le prochain chapitre : l'architecture complète.


# Chapitre 4 : Architecture complète d'un stablecoin (6 min · slides 33 à 40)

## [Diapo 4.0-titre]
Bon. Au chapitre 3, vous avez écrit votre premier Keo. Mais un contrat seul, ce n'est pas un stablecoin. Il faut une banque, des contrôles, des gens qui valident et des machines qui surveillent. Dans ce chapitre, je vous montre le système complet de Kéa. À la fin, vous saurez le dessiner de mémoire, et coder ses protections.

## [Diapo 4.1-architecture]
Regardez ce schéma. Une ligne pointillée le coupe en deux : à gauche, ce qui se passe hors de la blockchain ; à droite, ce qui se passe dessus. Suivons Alice, qui veut 100 Keo. Étape 1 : elle s'inscrit, et le contrôle KYC vérifie son identité. Étape 2 : elle vire 100 euros à la Banque Sorel. Étape 3 : la banque prévient le back-office de Kéa que les fonds sont arrivés. Étape 4 : le back-office appelle mint. Étape 5 : 100 Keo apparaissent dans le portefeuille d'Alice. Et au-dessus, la surveillance, qui observe tout. Alors, vous remarquez quelque chose ? La blockchain, c'est une étape sur cinq. Le reste, c'est du métier bancaire. Et c'est là que les projets échouent.

## [Diapo 4.2-criteres]
Première décision : quelle blockchain ? Il n'y a pas de bonne réponse, seulement des compromis. Je vous propose quatre critères. La sécurité : combien d'acteurs indépendants valident les blocs ? Le coût et la vitesse : combien coûte un transfert, et quand devient-il définitif ? La liquidité : où sont déjà les portefeuilles et les applications de vos clients ? Et la conformité : est-ce que je peux geler une adresse, ou tout mettre en pause ?

## [Diapo 4.2-chaines]
Appliquons ça à cinq candidates. Ethereum : la référence, un bloc toutes les douze secondes, l'écosystème le plus large, mais des frais qui grimpent quand le réseau est chargé. Une couche 2, comme Arbitrum ou Base : des frais bien plus faibles, une partie de la sécurité d'Ethereum, mais un séquenceur unique qui ordonne les transactions. Solana : très rapide, presque gratuite, mais le réseau s'est déjà arrêté, cinq heures en février 2024. Stellar : pensée pour les paiements, avec le gel intégré au protocole. Et la chaîne permissionnée : contrôle total, mais personne dessus. Le choix de Kéa : Ethereum pour lancer, une couche 2 ensuite. Et les grands émetteurs, eux, ne choisissent pas : en octobre 2026, Circle émet l'USDC sur 38 blockchains. Chaque chaîne, c'est un contrat de plus à surveiller.

## [Diapo 4.3-roles]
Maintenant, le contrat. Votre Keo du chapitre 3 n'a qu'un propriétaire : une seule clé à voler. Un émetteur régulé découpe le pouvoir en rôles, avec le module AccessControl d'OpenZeppelin. MINTER crée et détruit les jetons, avec un plafond. PAUSER peut tout arrêter en cas d'incident. BLACKLISTER gèle une adresse : elle ne peut plus ni envoyer ni recevoir. Et l'administrateur distribue les rôles. Retenez bien ça : un rôle, c'est une clé. Et une clé, ça se vole.

## [Diapo 4.3-code]
Voici ce que vous ajoutez dans votre contrat. En haut, le rôle BLACKLISTER et la liste noire : une table qui dit, pour chaque adresse, si elle est gelée. Ligne 4 : pause, réservée au PAUSER_ROLE. Ligne 6 : blacklist, protégée par onlyRole. Sans le rôle, la transaction échoue. En bas, le point clé : _update. Avec OpenZeppelin 5, chaque transfert, chaque création, chaque destruction passe par là. Ligne 12, vous refusez les adresses gelées ; puis super._update vérifie la pause. Ligne 11, le override cite les deux parents, ERC20 et ERC20Pausable : Solidity l'exige. L'USDC fait pareil. Le 8 août 2022, quand les États-Unis sanctionnent Tornado Cash, Circle gèle les adresses visées : au moins 75 000 USDC.

## [Diapo 4.4-back-office]
Passons au back-office, le logiciel interne de Kéa. Il commence par le KYC : l'identité du client, les listes de sanctions, l'adresse de son portefeuille. Ensuite, le virement. Un virement SEPA classique peut prendre jusqu'au jour ouvrable suivant. Le virement instantané arrive en dix secondes maximum, 24 heures sur 24. Puis vient l'ordre de création : une personne le prépare, une deuxième l'approuve, et la transaction part signée en multisignature. Règle d'or : jamais de jeton avant les euros. Le rachat, c'est le chemin inverse : Alice renvoie ses Keo, Kéa les détruit et lui vire ses euros. Et chaque soir, la réconciliation : banque, blockchain et registre interne doivent tomber juste.

## [Diapo 4.5-surveillance]
Dernière brique : la surveillance. Un stablecoin tourne 24 heures sur 24, les incidents aussi. Kéa écoute tous les événements de son contrat. Chaque création doit correspondre à un virement. L'offre totale, toutes chaînes confondues, ne doit jamais dépasser les réserves. Un rôle accordé hors procédure, une mise à jour imprévue : alerte. Vous croyez que c'est théorique ? Le 15 octobre 2025, Paxos a créé par erreur 300 000 milliards de PYUSD, le stablecoin de PayPal. Détruits en moins d'une demi-heure, mais le contrat avait tout accepté. Enfin, les clés : multisignature, par exemple trois signatures sur cinq, et HSM, un boîtier qui signe sans jamais laisser sortir la clé. Bon. Le système tient. Mais comment prouver, à quelqu'un qui ne vous croit pas, que les euros sont bien là ? C'est le chapitre 5.


# Chapitre 5 : Prouver les réserves (5 min · slides 41 à 47)

## [Diapo 5.0-titre]
Kéa a émis deux millions de Keo. Elle affirme avoir deux millions d'euros à la Banque Sorel. Pourquoi la croire ? Dans ce chapitre, je vous montre trois façons de le vérifier. Et ce qu'aucune ne prouve. À la fin, vous saurez juger si une preuve de réserves tient la route.

## [Diapo 5.1-confiance]
Ouvrez un explorateur de blocs et tapez l'adresse du contrat Keo. Vous voyez l'offre totale : deux millions. Vous voyez chaque création, chaque transfert, en direct. Maintenant, cherchez le compte de Kéa à la Banque Sorel. Rien. La blockchain montre ce que Kéa doit. Elle ne montre pas ce que Kéa possède. Or c'est exactement ce qui vous intéresse le jour où vous voulez récupérer vos euros. C'est tout le paradoxe : la partie transparente est la moins importante.

## [Diapo 5.2-balance]
Une preuve de réserves, c'est un ensemble d'éléments qui montrent, à une date donnée, que les réserves couvrent au moins les jetons. Des éléments qui ne viennent pas seulement de l'émetteur. Regardez cette balance. À gauche, les jetons en circulation. À droite, les réserves. La droite doit toujours peser au moins autant. Trois sources. La blockchain pèse la gauche, en direct. Un oracle publie la droite, automatiquement. Un auditeur vérifie le tout, chaque mois. Aucune ne suffit seule. Et retenez une limite : une preuve de réserves regarde ce que l'émetteur possède, pas ses autres dettes.

## [Diapo 5.3-attestation]
Attention au vocabulaire : une attestation, ce n'est pas un audit. L'attestation vérifie une affirmation précise, à une date précise : « le 31 août à minuit, les réserves couvraient les jetons ». Elle ne dit rien de la veille. L'audit, lui, examine tous les comptes sur un exercice entier : dettes, résultats, contrôles internes. Pour l'USDC, Circle publie chaque mois une attestation signée par Deloitte, selon les normes des experts-comptables américains. Fin août 2026 : 73,3 milliards d'USDC en circulation, 73,4 milliards de dollars de réserves. Environ 85 % sont dans le Circle Reserve Fund, un fonds monétaire géré par BlackRock, investi en titres du Trésor américain. Le reste, en dépôts. Pour Kéa, le Cabinet Varenne fera pareil chaque mois, avec une date choisie sans prévenir.

## [Diapo 5.4-oracle]
Problème : l'attestation arrive des semaines après. Et un smart contract ne lit pas les PDF. Il lui faut un oracle, un service qui apporte une donnée extérieure sur la blockchain. Avec Chainlink Proof of Reserve, des nœuds indépendants lisent les réserves à la source et les publient dans un flux. Le contrat Keo peut alors refuser tout mint qui dépasserait les réserves. L'erreur de Paxos ? Bloquée. Mais attention. Si la source ment, l'oracle publie fidèlement un mensonge. Chainlink le dit lui-même : quand c'est l'émetteur qui fournit ses chiffres, Chainlink Labs n'en garantit pas l'exactitude. Voilà pourquoi le flux de Kéa vient de la Banque Sorel, pas de Kéa.

## [Diapo 5.5-tether]
Le cas d'école, c'est Tether, l'émetteur de l'USDT, le plus gros stablecoin. En 2021, deux sanctions. La procureure générale de New York : 18,5 millions de dollars, car Tether n'avait pas toujours les réserves annoncées. La CFTC : 41 millions, car les réserves ne couvraient les jetons que 27,6 % des jours étudiés. Ensuite, des attestations trimestrielles de BDO, mais pendant des années, pas d'audit complet. En août 2026, Tether annonce enfin une opinion sans réserve de KPMG sur ses comptes 2025. Des comptes non publiés à l'annonce, cela dit. Et en Europe, l'USDT n'est pas autorisé sous MiCA : Coinbase l'a retiré fin 2024, Binance fin mars 2025. Le 8 octobre 2026, l'autorité européenne des marchés a donné trois mois aux plateformes pour tourner la page.

## [Diapo 5.5-svb]
Dernière leçon, et pas la moindre : même des réserves réelles portent un risque. Le 10 mars 2023, la Silicon Valley Bank fait faillite. Circle y a 3,3 milliards de dollars de réserves. Le lendemain, l'USDC tombe à 87 cents sur Kraken. Il faut que les autorités américaines garantissent tous les dépôts, le 12 mars, pour qu'il revienne près d'un dollar. Les réserves existaient. Elles étaient attestées. Le risque était dans la banque. Bon. Prouver ne suffit pas, il faut aussi encadrer. Ce que l'Europe impose à Kéa, et comment le code l'applique : c'est le chapitre 6.


# Chapitre 6 : La conformité (6 min · slides 48 à 55)

## [Diapo 6.0-titre]
Bon. Kéa a un contrat, une architecture et des réserves prouvées. Il lui manque une chose : le droit d'émettre. Dans ce chapitre, je vous montre les règles qui comptent le plus, d'où elles viennent, et comment chacune devient du code.

## [Diapo 6.1-emt-art]
Le texte central, c'est MiCA. Le règlement européen 2023/1114, adopté le 31 mai 2023. Un règlement : il s'applique directement, partout dans l'Union.
MiCA range les stablecoins en deux familles. À gauche, l'EMT, le jeton de monnaie électronique. Il se réfère à une seule monnaie officielle. Le Keo, adossé à l'euro ? C'est un EMT. Comme EURCV ou USDC en Europe.
À droite, l'ART, le jeton qui se réfère à autre chose : un panier de devises, de l'or…
Alors, qui a le droit d'émettre un EMT ? Deux acteurs seulement : une banque, ou un établissement de monnaie électronique, un EME. C'est l'article 48. Voilà pourquoi Kéa doit obtenir son agrément d'EME auprès de l'ACPR. Et publier un livre blanc qui décrit son jeton.

## [Diapo 6.1-calendrier]
Regardez le calendrier. Les règles sur les stablecoins s'appliquent depuis le 30 juin 2024. Tout le reste, depuis le 30 décembre 2024. Ce « reste », ce sont surtout les PSCA, les prestataires de services sur crypto-actifs : plateformes, conservateurs.
Ceux qui existaient déjà ont eu une période de transition. Elle s'est terminée partout le 1er juillet 2026.
Et si le Keo devient très gros ? S'il coche au moins trois critères, par exemple plus de 10 millions de détenteurs ou plus de 5 milliards d'euros émis, l'Autorité bancaire européenne le classe « d'importance significative ». Elle surveille alors elle-même ses obligations renforcées.
Aux États-Unis, le GENIUS Act, promulgué le 18 juillet 2025, suit la même logique de réserves. Avec une différence que je garde pour le gel.

## [Diapo 6.2-rachat]
Maintenant, la règle la plus importante pour Alice. Elle a 100 Keo. Elle veut ses 100 euros. Kéa peut-elle répondre « pas avant la fin du trimestre » ?
Non. Lisez l'article 49. L'émetteur rembourse « à tout moment et au pair ». À tout moment : ni préavis, ni fenêtre de rachat. Au pair : un Keo, un euro. Et en vrais euros, sur un compte bancaire. Pas en un autre jeton.

## [Diapo 6.2-regles]
Le même article dit aussi que le rachat est gratuit. Une seule exception : en pleine crise, le plan de redressement de l'émetteur peut prévoir des frais, voire une suspension. Un plan d'urgence, pas un tarif.
Colonne de droite, l'article 50 : pas d'intérêts. Même déguisés : un bonus lié à la durée de détention compte comme un intérêt. Un EMT, c'est de la monnaie, pas un placement. Gardez ça en tête, ça va servir au chapitre 7.

## [Diapo 6.3-gel]
Changement de scène. L'équipe conformité de Kéa découvre qu'une adresse qui détient 50 000 Keo appartient à une société sanctionnée. Que fait Kéa ?
Elle gèle. Mais attention : ce n'est pas MiCA qui l'impose. MiCA donne seulement aux autorités le pouvoir de demander un gel, dans les enquêtes sur les abus de marché. C'est là que le GENIUS Act diffère : lui exige que l'émetteur sache geler.
En Europe, l'obligation vient de trois sources. Les sanctions : la DG Trésor tient le registre national des gels. La justice : un juge peut ordonner une saisie. Et la LCB-FT : Tracfin peut bloquer une opération suspecte pendant dix jours ouvrables.
Trois sources, une seule réponse technique : la liste noire du chapitre 4. Et un rappel. Geler n'est pas confisquer : les Keo gelés restent une dette de Kéa.

## [Diapo 6.4-voyage]
Quatrième règle : la traçabilité. Sur la blockchain, vous voyez qu'une adresse envoie 100 Keo à une autre. Vous ne savez pas qui est derrière.
Le règlement TFR, en application depuis le 30 décembre 2024, comble ce trou avec la règle du voyage. L'idée : l'identité voyage avec l'argent. Quand un PSCA envoie des jetons pour son client, il transmet au PSCA d'en face qui envoie et qui reçoit. Hors de la chaîne, par un canal sécurisé. Et sans seuil : un euro ou un million, c'est pareil.
Si le destinataire est un portefeuille auto-hébergé, il n'y a personne en face. Le PSCA garde alors les informations. Et au-delà de 1 000 euros, il vérifie que l'adresse appartient bien à son client.

## [Diapo 6.5-loi-au-code]
Voilà tout le chapitre en une diapositive. À gauche, la règle. À droite, ce que vous coderez vous-même dans le cas pratique, avec OpenZeppelin v5.
Émettre au pair : la fonction mint, réservée au rôle MINTER. Racheter : burn, puis le virement en euros. Geler : blacklist, plus un contrôle dans _update, la fonction qui voit passer chaque transfert. Tracer : les événements Transfer, plus la règle du voyage. Et l'incident : pause et unpause, réservées au rôle PAUSER.
Un piège, quand même. Une pause bloque tout, rachats compris. Si elle dure, c'est le droit au rachat que vous suspendez.
Mon conseil : pour chaque règle, demandez-vous quelle fonction l'applique, et qui a le droit de l'appeler.
Dans le chapitre suivant, on sort de la monnaie : fonds, obligations, immobilier.


# Chapitre 7 : Au-delà des stablecoins (4 min · slides 56 à 61)

## [Diapo 7.0-titre]
Au chapitre 6, MiCA a interdit à Kéa de verser des intérêts. Ses clients le remarquent vite : leurs Keo dorment sans rien rapporter. La réponse de Kéa sort du monde des stablecoins.

## [Diapo 7.1-spectre-actifs]
Regardez ce spectre. À gauche, la monnaie : facile à tokeniser, sa valeur est évidente. Plus vous allez vers la droite, plus c'est dur. La valeur est plus difficile à établir, le marché moins liquide, le transfert de propriété plus complexe.
Juste après la monnaie, les fonds monétaires, comme BUIDL de BlackRock. Ce sont les plus faciles : une valeur calculée chaque jour, des actifs très liquides. Puis les obligations : SG-Forge en émet sur Ethereum depuis 2019.
Et l'immobilier ? On en parle beaucoup, il pèse très peu. Environ 0,2 milliard de dollars tokenisés en octobre 2026, selon rwa.xyz, contre 14,5 milliards pour les bons du Trésor américain. Un immeuble est unique, et sa vente passe par un notaire.

## [Diapo 7.2-instrument]
Alors, qu'est-ce qui change quand Kéa passe du Keo à une part de fonds ?
D'abord le droit. Une part de fonds tokenisée n'est pas un crypto-actif au sens de MiCA : c'est un instrument financier. MiCA s'efface, MiFID II prend le relais. Pour les marchés sur blockchain, l'Europe a ouvert un bac à sable : le régime pilote DLT, en application depuis le 23 mars 2023. La Commission le juge trop étroit et propose de l'élargir.
Ensuite le jeton. Le Keo circule librement. Une part de fonds, non : seuls des investisseurs identifiés peuvent la détenir. D'où le standard ERC-3643. Avant chaque transfert, le contrat vérifie l'identité du destinataire. La liste noire devient une liste blanche.

## [Diapo 7.2-paiement]
Dernier changement, le plus subtil. Acheter un titre, c'est échanger un titre contre de l'argent. La livraison contre paiement garantit que l'un ne part pas sans l'autre. Sur une blockchain, il faut donc que l'argent soit, lui aussi, un jeton.
Première option : le stablecoin. En 2023, AXA IM a réglé une partie d'une obligation de Société Générale en EURCV.
Deuxième option : la monnaie de banque centrale. Le 21 septembre 2026, l'Eurosystème a lancé Pontes, qui relie les blockchains aux paiements TARGET. C'est réservé aux institutions. Et Appia, la piste de long terme, doit livrer son plan d'ici 2028.

## [Diapo 7.3-limites]
Je ne vais pas vous vendre un rêve. Il reste quatre limites.
La liquidité : un jeton s'échange 24 heures sur 24, encore faut-il un acheteur en face. Les chaînes : un jeton sur Ethereum ne passe pas seul sur une autre blockchain. Le droit : en cas de litige, le jeton fait-il foi ? La France a pris de l'avance, mais ce n'est pas le cas partout. Et les dépendances : la valeur arrive par un oracle, l'actif dort chez un dépositaire. Si l'un des deux flanche, le jeton devient une promesse vide.

## [Diapo 7.3-kea]
Alors, le projet de Kéa. Kéa ne gère pas le fonds : c'est le métier d'une société de gestion, avec un dépositaire. Kéa apporte ce qu'elle sait faire : le KYC, les portefeuilles et le Keo pour payer. Côté technique, chaque part devient un jeton ERC-3643 : pas de KYC, pas de part. La PME place sa trésorerie dans le fonds. Puis elle revend ses parts contre des Keo le jour où elle doit payer un fournisseur.
Il ne reste plus qu'à tout assembler. C'est la conclusion.


# Conclusion (2 min · slides 62 à 64)

## [Diapo fin-recap]
Bon. On arrive au bout. Si vous ne deviez retenir que cinq idées, les voici.
Un : un stablecoin est une promesse. Un Keo vaut un euro tant que quelqu'un tient cette promesse. Deux : le code est simple. Au fond, c'est un registre de soldes. Trois : le système est bien plus grand que le code. Banque, KYC, back-office, rôles, surveillance. Quatre : la confiance se prouve, avec des réserves, des attestations, des oracles. Et leurs limites. Cinq : la loi s'écrit dans le code.

## [Diapo fin-carte-du-cours]
Vous vous souvenez de cet iceberg ? Au début du cours, vous ne voyiez que la pointe : un euro qui circule en quelques secondes. Maintenant, vous savez ce qu'il y a dessous. Le code ERC-20. L'architecture, de la banque au portefeuille. La preuve de réserves. Et tout en bas, la conformité, qui porte tout le reste.
Et ça ne s'arrête pas à la monnaie. Fonds, obligations, un jour peut-être l'immeuble : les deux mêmes questions reviendront. Qui tient la promesse ? Et comment le vérifier ?

## [Diapo fin-et-apres]
Et après ? Après, c'est à vous de coder. Dans le cas pratique, la Banque Valmorin lance son stablecoin, l'EURVAL, et c'est vous qui l'écrivez, en Solidity, avec OpenZeppelin v5. Des rôles, une pause, une liste noire, la création et la destruction. Puis vous le déployez dans Remix, et vous testez chaque règle du chapitre 6, une transaction après l'autre. Si vous bloquez, chaque fonction renvoie à un chapitre du cours.
Je ne sais pas si c'est l'âge, mais ce qui m'enthousiasme le plus là-dedans, ce n'est pas la blockchain. C'est de voir un article de loi devenir une ligne de code. J'ai hâte de lire votre contrat. À bientôt.


