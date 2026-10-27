// The fish catalogue: over 500 real aquarium fish, species and the named varieties stores sell
// (betta tail types, guppy strains, koi varieties, fancy goldfish, discus strains, designer
// clownfish…). Grouped by family, which sets the water, temperature, body shape and favourite
// decorations; each line then gives:
//
//   Name | Scientific name | size (S/M/L/XL/XXL) | rarity | colours (body/belly/fins) | pattern | pattern colour | flags | shape
//
// Flags: P = predator (eats much smaller fish), S = one per tank, A = must live alone.
// Sizes are adult sizes: S under ~7 cm, M to ~15 cm, L to ~35 cm, XL to ~80 cm, XXL bigger.

export const FAMILIES: { head: string; lines: string }[] = [
	{
		head: 'fresh tropical fish plants',
		lines: `
Neon Tetra|Paracheirodon innesi|S|common|silver/white/silver|neon|cyan
Cardinal Tetra|Paracheirodon axelrodi|S|common|silver/red/silver|neon|cyan
Green Neon Tetra|Paracheirodon simulans|S|uncommon|silver/white/silver|neon|teal
Black Neon Tetra|Hyphessobrycon herbertaxelrodi|S|common|olive/white/silver|hstripes|black
Ember Tetra|Hyphessobrycon amandae|S|common|orange/orange/orange|none|
Rummy-nose Tetra|Hemigrammus rhodostomus|S|common|silver/white/black|zebra|black
Lemon Tetra|Hyphessobrycon pulchripinnis|S|common|yellow/cream/yellow|none|
Serpae Tetra|Hyphessobrycon eques|S|common|red/red/black|none|
Black Skirt Tetra|Gymnocorymbus ternetzi|S|common|gray/silver/black|vbands|black
Glowlight Tetra|Hemigrammus erythrozonus|S|common|silver/white/silver|neon|orange
Bleeding Heart Tetra|Hyphessobrycon erythrostigma|S|uncommon|pink/silver/pink|spots|red
Black Phantom Tetra|Hyphessobrycon megalopterus|S|uncommon|gray/silver/black|spots|black
Red Phantom Tetra|Hyphessobrycon sweglesi|S|uncommon|red/orange/red|spots|black
Congo Tetra|Phenacogrammus interruptus|M|uncommon|gold/cyan/violet|hstripes|blue
Diamond Tetra|Moenkhausia pittieri|S|uncommon|silver/white/violet|spots|white
Emperor Tetra|Nematobrycon palmeri|S|uncommon|tan/gold/violet|hstripes|black
Penguin Tetra|Thayeria boehlkei|S|common|silver/white/silver|hstripes|black
X-ray Tetra|Pristella maxillaris|S|common|cream/white/yellow|spots|black
Head and Tail Light Tetra|Hemigrammus ocellifer|S|common|silver/white/silver|spots|orange
Silver Tip Tetra|Hasemania nana|S|common|gold/cream/white|none|
Buenos Aires Tetra|Psalidodon anisitsi|S|common|silver/white/red|hstripes|black
Kerri Tetra|Inpaichthys kerri|S|uncommon|blue/tan/blue|hstripes|navy
Neon Green Tetra|Paracheirodon simulans|S|uncommon|silver/white/silver|neon|green
Gold Tetra|Hemigrammus rodwayi|S|uncommon|gold/gold/red|none|
Columbian Tetra|Hyphessobrycon columbianus|S|common|blue/silver/red|none|
Rosy Tetra|Hyphessobrycon rosaceus|S|uncommon|pink/silver/red|spots|black
Flame Tetra|Hyphessobrycon flammeus|S|common|red/orange/red|spots|black
Glass Bloodfin Tetra|Prionobrama filigera|S|common|silver/white/red|none|
Bloodfin Tetra|Aphyocharax anisitsi|S|common|silver/white/red|none|
Pristella Tetra|Pristella maxillaris|S|common|cream/white/cream|spots|black
Coral Red Pencilfish|Nannostomus mortenthaleri|S|rare|red/orange/red|hstripes|darkred
Beckford's Pencilfish|Nannostomus beckfordi|S|uncommon|gold/cream/red|hstripes|black
Marbled Hatchetfish|Carnegiella strigata|S|uncommon|silver/white/silver|marble|black|-|tall
Silver Hatchetfish|Gasteropelecus sternicla|S|common|silver/white/silver|none||-|tall
Green Fire Tetra|Aphyocharax rathbuni|S|rare|green/red/green|split|red
Blue King Tetra|Inpaichthys kerri|S|rare|blue/violet/blue|hstripes|navy
Albino Neon Tetra|Paracheirodon innesi (albino)|S|rare|white/white/white|neon|pink
Black Widow Tetra (Long-fin)|Gymnocorymbus ternetzi|S|uncommon|black/gray/black|vbands|silver
Sunset Platinum Tetra|Hyphessobrycon sp. (platinum)|S|rare|white/orange/white|none|
Exodon|Exodon paradoxus|M|rare|gold/cream/red|spots|black|P
`
	},
	{
		head: 'fresh tropical fish plants',
		lines: `
Cherry Barb|Puntius titteya|S|common|red/red/red|none|
Tiger Barb|Puntigrus tetrazona|S|common|gold/cream/red|vbands|black
Green Tiger Barb|Puntigrus tetrazona (moss)|S|common|olive/green/red|vbands|green
Albino Tiger Barb|Puntigrus tetrazona (albino)|S|uncommon|cream/white/red|vbands|white
Rosy Barb|Pethia conchonius|M|common|pink/orange/black|none|
Odessa Barb|Pethia padamya|S|uncommon|red/silver/black|spots|black
Gold Barb|Barbodes semifasciolatus|S|common|gold/yellow/orange|spots|black
Checkerboard Barb|Oliotius oligolepis|S|uncommon|gold/cream/red|marble|black
Denison Barb|Sahyadria denisonii|M|rare|silver/white/red|hstripes|red
Black Ruby Barb|Pethia nigrofasciata|S|uncommon|darkred/red/black|vbands|black
Cherry Barb (Long-fin)|Puntius titteya|S|uncommon|red/red/red|none|
Clown Barb|Barbodes everetti|M|uncommon|orange/gold/red|spots|black
Pentazona Barb|Desmopuntius pentazona|S|uncommon|gold/red/red|vbands|black
Tinfoil Barb|Barbonymus schwanenfeldii|L|common|silver/silver/red|none|
Arulius Barb|Dawkinsia arulius|M|uncommon|silver/white/red|spots|black
Snakeskin Barb|Desmopuntius rhomboocellatus|S|rare|gold/orange/red|marble|black
Ruby Barb|Pethia nigrofasciata|S|uncommon|red/red/black|none|
Golden Dwarf Barb|Pethia gelius|S|uncommon|gold/cream/gold|spots|black
Pygmy Barb|Puntius gelius|S|common|gold/cream/gold|none|
Melon Barb|Haludaria fasciata|S|uncommon|orange/pink/red|vbands|black
`
	},
	{
		head: 'fresh tropical fish plants',
		lines: `
Zebra Danio|Danio rerio|S|common|gold/cream/gold|hstripes|navy
Leopard Danio|Danio rerio (leopard)|S|common|gold/cream/gold|spots|navy
Long-fin Zebra Danio|Danio rerio (long-fin)|S|common|gold/cream/gold|hstripes|navy
Pearl Danio|Danio albolineatus|S|common|silver/pink/orange|none|
Celestial Pearl Danio|Danio margaritatus|S|uncommon|navy/orange/orange|spots|gold
Giant Danio|Devario aequipinnatus|M|common|blue/silver/gold|hstripes|gold
Glowlight Danio|Danio choprae|S|uncommon|gold/orange/red|vbands|navy
Kyathit Danio|Danio kyathit|S|uncommon|gold/cream/orange|spots|navy
Harlequin Rasbora|Trigonostigma heteromorpha|S|common|orange/pink/red|split|black
Lambchop Rasbora|Trigonostigma espei|S|common|orange/pink/orange|split|black
Chili Rasbora|Boraras brigittae|S|uncommon|red/red/red|hstripes|darkred
Phoenix Rasbora|Boraras merah|S|uncommon|orange/red/red|spots|black
Galaxy Rasbora|Danio margaritatus|S|uncommon|navy/orange/orange|spots|gold
Scissortail Rasbora|Rasbora trilineata|S|common|silver/white/silver|hstripes|black
Brilliant Rasbora|Rasbora einthovenii|S|uncommon|silver/white/silver|hstripes|navy
Red-line Rasbora|Rasbora pauciperforata|S|uncommon|silver/white/silver|hstripes|red
Exclamation Point Rasbora|Boraras urophthalmoides|S|rare|orange/red/orange|hstripes|black
Kubotai Rasbora|Microdevario kubotai|S|uncommon|green/silver/green|none|
Dwarf Spotted Rasbora|Boraras maculatus|S|uncommon|orange/pink/orange|spots|black
Emerald Dwarf Rasbora|Danio erythromicron|S|rare|blue/orange/orange|vbands|blue
Sparkling Gourami|Trichopsis pumila|S|uncommon|tan/blue/red|spots|blue|-|tall
Neon Blue Rasbora|Sundadanio axelrodi|S|rare|blue/teal/red|none|
Flying Fox|Epalzeorhynchos kalopterus|M|common|tan/cream/black|hstripes|black
Siamese Algae Eater|Crossocheilus oblongus|M|common|silver/white/silver|hstripes|black
Red-tailed Black Shark|Epalzeorhynchos bicolor|M|common|black/black/red|split|red|S
Rainbow Shark|Epalzeorhynchos frenatum|M|common|gray/gray/red|none||S
Albino Rainbow Shark|Epalzeorhynchos frenatum (albino)|M|uncommon|white/white/red|none||S
Bala Shark|Balantiocheilos melanopterus|L|uncommon|silver/white/gold|none|
Black Shark Minnow|Labeo chrysophekadion|L|rare|black/gray/black|none||A
Chinese Algae Eater|Gyrinocheilus aymonieri|M|common|gold/cream/gold|none|
`
	},
	{
		head: 'fresh tropical guppy plants',
		lines: `
Guppy|Poecilia reticulata|S|common|silver/white/orange|spots|blue
Cobra Guppy|Poecilia reticulata (cobra)|S|common|olive/cream/green|marble|black
Tuxedo Guppy|Poecilia reticulata (tuxedo)|S|common|silver/white/blue|split|black
Mosaic Guppy|Poecilia reticulata (mosaic)|S|common|silver/white/blue|marble|navy
Full Red Guppy|Poecilia reticulata (full red)|S|uncommon|red/red/red|none|
Full Black Guppy|Poecilia reticulata (full black)|S|uncommon|black/black/black|none|
Blue Moscow Guppy|Poecilia reticulata (Moscow)|S|uncommon|blue/navy/blue|none|
Purple Moscow Guppy|Poecilia reticulata (Moscow)|S|uncommon|purple/violet/purple|none|
Dumbo Ear Guppy|Poecilia reticulata (dumbo ear)|S|uncommon|pink/white/red|none|
Platinum Guppy|Poecilia reticulata (platinum)|S|uncommon|white/silver/white|none|
Koi Guppy|Poecilia reticulata (koi)|S|uncommon|white/white/red|calico|red
Albino Full Red Guppy|Poecilia reticulata (albino)|S|rare|red/pink/red|none|
Dragon Head Guppy|Poecilia reticulata (dragon)|S|rare|black/gray/blue|split|red
Japan Blue Guppy|Poecilia reticulata (Japan blue)|S|uncommon|blue/silver/blue|spots|navy
Yellow Lace Guppy|Poecilia reticulata (lace)|S|uncommon|yellow/cream/yellow|marble|black
Galaxy Guppy|Poecilia reticulata (galaxy)|S|uncommon|blue/silver/violet|spots|white
Red Lace Snakeskin Guppy|Poecilia reticulata (snakeskin)|S|uncommon|red/cream/red|marble|black
Half Black Pastel Guppy|Poecilia reticulata (half black)|S|uncommon|white/white/pink|split|black
Endler's Livebearer|Poecilia wingei|S|common|green/silver/orange|spots|black
Tiger Endler|Poecilia wingei (tiger)|S|uncommon|orange/silver/orange|vbands|black
Black Bar Endler|Poecilia wingei (black bar)|S|uncommon|green/silver/orange|vbands|black
`
	},
	{
		head: 'fresh tropical fish plants',
		lines: `
Platy|Xiphophorus maculatus|S|common|orange/gold/orange|none|
Red Wag Platy|Xiphophorus maculatus (red wag)|S|common|red/red/black|none|
Mickey Mouse Platy|Xiphophorus maculatus (mickey)|S|common|gold/yellow/gold|spots|black
Blue Coral Platy|Xiphophorus maculatus (blue coral)|S|common|blue/silver/blue|none|
Sunset Platy|Xiphophorus maculatus (sunset)|S|common|yellow/orange/red|split|red
Tuxedo Platy|Xiphophorus maculatus (tuxedo)|S|common|red/red/red|split|black
Calico Platy|Xiphophorus maculatus (calico)|S|uncommon|white/white/orange|calico|orange
Variatus Platy|Xiphophorus variatus|S|common|yellow/blue/red|none|
Salt and Pepper Platy|Xiphophorus maculatus|S|common|silver/white/silver|spots|black
Panda Platy|Xiphophorus maculatus (panda)|S|uncommon|white/white/black|split|black
Black Molly|Poecilia sphenops|M|common|black/black/black|none|
Dalmatian Molly|Poecilia latipinna (dalmatian)|M|common|white/white/white|spots|black
Gold Dust Molly|Poecilia sphenops (gold dust)|M|common|gold/yellow/black|split|black
Balloon Molly|Poecilia latipinna (balloon)|M|common|orange/white/orange|none||-|puffy
Sailfin Molly|Poecilia latipinna|M|uncommon|silver/white/orange|spots|navy|-|tall
Lyretail Molly|Poecilia sphenops (lyretail)|M|common|black/black/black|none|
Silver Molly|Poecilia sphenops (silver)|M|common|silver/white/silver|none|
Creamsicle Molly|Poecilia latipinna (creamsicle)|M|common|orange/cream/orange|split|white
Red Swordtail|Xiphophorus hellerii|M|common|red/red/red|none|
Green Swordtail|Xiphophorus hellerii|M|common|green/silver/orange|hstripes|red
Black Swordtail|Xiphophorus hellerii (black)|M|common|black/black/black|none|
Pineapple Swordtail|Xiphophorus hellerii (pineapple)|M|common|yellow/orange/orange|calico|red
Koi Swordtail|Xiphophorus hellerii (koi)|M|uncommon|white/white/red|calico|red
Neon Swordtail|Xiphophorus hellerii (neon)|M|uncommon|red/red/cyan|split|cyan
Mosquitofish|Gambusia affinis|S|common|silver/white/silver|none|
Least Killifish|Heterandria formosa|S|uncommon|tan/cream/tan|hstripes|black
`
	},
	{
		head: 'fresh tropical betta plants S',
		lines: `
Betta|Betta splendens|S|uncommon|blue/navy/red|none|
Halfmoon Betta|Betta splendens (halfmoon)|S|uncommon|blue/navy/blue|none|
Crowntail Betta|Betta splendens (crowntail)|S|uncommon|red/darkred/red|none|
Plakat Betta|Betta splendens (plakat)|S|uncommon|red/darkred/blue|none|
Double Tail Betta|Betta splendens (double tail)|S|uncommon|purple/violet/purple|none|
Veiltail Betta|Betta splendens (veiltail)|S|common|red/darkred/red|none|
Delta Tail Betta|Betta splendens (delta)|S|uncommon|teal/blue/teal|none|
Rosetail Betta|Betta splendens (rosetail)|S|rare|pink/white/pink|none|
Dumbo Ear Betta|Betta splendens (dumbo ear)|S|rare|white/white/white|none|
Koi Betta|Betta splendens (koi)|S|rare|white/white/red|calico|red
Galaxy Koi Betta|Betta splendens (galaxy koi)|S|rare|navy/white/red|calico|cyan
Black Orchid Betta|Betta splendens (black orchid)|S|rare|black/navy/blue|marble|blue
Mustard Gas Betta|Betta splendens (mustard gas)|S|rare|blue/navy/yellow|split|yellow
Copper Betta|Betta splendens (copper)|S|rare|gold/orange/gold|marble|teal
Avatar Betta|Betta splendens (avatar)|S|ultra|cyan/silver/cyan|none|
Black Samurai Betta|Betta splendens (samurai)|S|ultra|black/gray/black|marble|cyan
Butterfly Betta|Betta splendens (butterfly)|S|uncommon|blue/navy/white|split|white
Cellophane Betta|Betta splendens (cellophane)|S|uncommon|white/pink/white|none|
Nemo Betta|Betta splendens (nemo)|S|rare|orange/gold/red|calico|black
Alien Betta|Betta hybrid (alien)|S|ultra|teal/navy/teal|spots|cyan
Wild Betta (Imbellis)|Betta imbellis|S|uncommon|navy/black/red|none|
Betta macrostoma|Betta macrostoma|S|epic|orange/red/black|none||S|fish
`
	},
	{
		head: 'fresh tropical tall plants',
		lines: `
Dwarf Gourami|Trichogaster lalius|S|uncommon|red/orange/blue|vbands|blue
Powder Blue Gourami|Trichogaster lalius (powder blue)|S|uncommon|blue/blue/red|none|
Honey Gourami|Trichogaster chuna|S|common|gold/yellow/orange|none|
Pearl Gourami|Trichopodus leerii|M|common|tan/orange/tan|spots|white
Blue Gourami|Trichopodus trichopterus|M|common|blue/silver/blue|spots|navy
Gold Gourami|Trichopodus trichopterus (gold)|M|common|gold/yellow/gold|marble|orange
Opaline Gourami|Trichopodus trichopterus (opaline)|M|common|blue/silver/blue|marble|navy
Moonlight Gourami|Trichopodus microlepis|M|uncommon|silver/white/silver|none|
Kissing Gourami|Helostoma temminckii|L|common|pink/white/pink|none|
Chocolate Gourami|Sphaerichthys osphromenoides|S|rare|brown/tan/brown|vbands|gold
Licorice Gourami|Parosphromenus deissneri|S|epic|black/brown/blue|hstripes|gold
Giant Gourami|Osphronemus goramy|XL|rare|gray/cream/gray|none||P
Paradise Fish|Macropodus opercularis|M|common|red/blue/red|vbands|blue|S
Thick-lipped Gourami|Trichogaster labiosa|M|uncommon|orange/blue/orange|vbands|blue
Croaking Gourami|Trichopsis vittata|S|uncommon|tan/cream/blue|hstripes|brown
`
	},
	{
		head: 'fresh tropical tall plants,wood',
		lines: `
Freshwater Angelfish|Pterophyllum scalare|M|uncommon|silver/white/silver|vbands|black
Marble Angelfish|Pterophyllum scalare (marble)|M|uncommon|white/white/white|marble|black
Koi Angelfish|Pterophyllum scalare (koi)|M|uncommon|white/white/orange|calico|orange
Platinum Angelfish|Pterophyllum scalare (platinum)|M|rare|white/white/white|none|
Black Angelfish|Pterophyllum scalare (black)|M|uncommon|black/black/black|none|
Zebra Angelfish|Pterophyllum scalare (zebra)|M|uncommon|silver/white/silver|zebra|black
Leopard Angelfish|Pterophyllum scalare (leopard)|M|uncommon|silver/white/silver|spots|black
Gold Angelfish|Pterophyllum scalare (gold)|M|uncommon|gold/yellow/gold|none|
Blue Angelfish|Pterophyllum scalare (Pinoy blue)|M|rare|silver/blue/blue|vbands|navy
Red Devil Angelfish|Pterophyllum scalare (red devil)|M|rare|darkred/red/darkred|none|
Altum Angelfish|Pterophyllum altum|L|epic|silver/white/red|vbands|darkred
Leopold's Angelfish|Pterophyllum leopoldi|M|rare|silver/white/silver|vbands|black
`
	},
	{
		head: 'fresh tropical disc wood,plants',
		lines: `
Discus|Symphysodon aequifasciatus|M|rare|teal/orange/teal|marble|orange
Blue Diamond Discus|Symphysodon (blue diamond)|M|rare|cyan/blue/cyan|none|
Red Turquoise Discus|Symphysodon (red turquoise)|M|rare|red/orange/teal|marble|teal
Pigeon Blood Discus|Symphysodon (pigeon blood)|M|rare|orange/white/orange|marble|red
Leopard Snakeskin Discus|Symphysodon (leopard snakeskin)|M|ultra|cream/white/red|spots|red
Checkerboard Discus|Symphysodon (checkerboard)|M|ultra|orange/white/orange|marble|teal
Red Melon Discus|Symphysodon (red melon)|M|ultra|red/red/red|none|
Albino Discus|Symphysodon (albino)|M|ultra|white/white/orange|marble|orange
Marlboro Red Discus|Symphysodon (Marlboro red)|M|ultra|red/white/red|split|white
Golden Leopard Discus|Symphysodon (golden leopard)|M|epic|gold/white/gold|spots|red
Heckel Discus|Symphysodon discus|M|epic|brown/tan/red|vbands|navy
Royal Blue Discus|Symphysodon aequifasciatus (royal blue)|M|ultra|blue/teal/blue|hstripes|cyan
Snow White Discus|Symphysodon (snow white)|M|ultra|white/white/white|none|
Pearl Rose Discus|Symphysodon (pearl rose)|M|rare|pink/white/pink|none|
Ghost Discus|Symphysodon (ghost)|M|ultra|white/silver/gold|none|
`
	},
	{
		head: 'fresh tropical tall sand,cave,plants',
		lines: `
German Blue Ram|Mikrogeophagus ramirezi|S|rare|yellow/blue/blue|spots|navy
Electric Blue Ram|Mikrogeophagus ramirezi (electric blue)|S|rare|blue/cyan/blue|spots|navy
Gold Ram|Mikrogeophagus ramirezi (gold)|S|rare|gold/yellow/orange|none|
Bolivian Ram|Mikrogeophagus altispinosus|M|uncommon|gold/cream/red|spots|black
Kribensis|Pelvicachromis pulcher|M|common|tan/pink/gold|hstripes|black
Apistogramma cacatuoides|Apistogramma cacatuoides|S|uncommon|gold/cream/red|hstripes|black
Apistogramma agassizii|Apistogramma agassizii|S|uncommon|blue/gold/red|hstripes|black
Apistogramma borellii|Apistogramma borellii|S|rare|yellow/blue/blue|none|
Apistogramma macmasteri|Apistogramma macmasteri|S|rare|gold/cream/red|vbands|black
Apistogramma viejita|Apistogramma viejita|S|rare|orange/gold/red|hstripes|black
Panda Apistogramma|Apistogramma nijsseni|S|ultra|cream/gold/red|spots|black
Checkerboard Cichlid|Dicrossus filamentosus|S|rare|tan/cream/red|marble|black
Keyhole Cichlid|Cleithracara maronii|M|uncommon|tan/cream/tan|spots|black
Shell Dweller (Multies)|Neolamprologus multifasciatus|S|uncommon|tan/cream/tan|vbands|brown
Brevis Shell Dweller|Neolamprologus brevis|S|uncommon|tan/cream/gold|vbands|brown
Lyretail Lamprologus|Neolamprologus brichardi|M|uncommon|tan/cream/white|none|
Lemon Cichlid|Neolamprologus leleupi|M|uncommon|yellow/yellow/yellow|none|
Daffodil Cichlid|Neolamprologus pulcher|M|uncommon|cream/yellow/blue|none|
Golden Dwarf Acara|Nannacara anomala|S|uncommon|gold/green/gold|marble|teal
Blue Acara|Andinoacara pulcher|M|common|blue/gray/blue|spots|cyan
`
	},
	{
		head: 'fresh tropical fish rock,sand',
		lines: `
Yellow Lab|Labidochromis caeruleus|M|common|yellow/yellow/black|none|
Electric Blue Johanni|Melanochromis cyaneorhabdos|M|common|blue/navy/blue|hstripes|navy
Red Zebra Cichlid|Maylandia estherae|M|common|orange/orange/orange|none|
Demasoni|Pseudotropheus demasoni|S|uncommon|blue/navy/blue|vbands|navy
Acei Cichlid|Pseudotropheus acei|M|common|violet/blue/yellow|none|
Kenyi Cichlid|Maylandia lombardoi|M|common|blue/blue/blue|vbands|navy|A
Auratus Cichlid|Melanochromis auratus|M|common|gold/yellow/gold|hstripes|black|A
Rusty Cichlid|Iodotropheus sprengerae|M|common|brown/violet/brown|none|
Cobalt Blue Zebra|Maylandia callainos|M|common|blue/cyan/blue|none|
Saulosi Cichlid|Chindongo saulosi|S|uncommon|yellow/yellow/yellow|none|
Bumblebee Cichlid|Pseudotropheus crabro|M|uncommon|yellow/yellow/black|vbands|black
Pseudotropheus Elongatus|Pseudotropheus elongatus|M|uncommon|blue/navy/blue|vbands|black
OB Peacock|Aulonocara (OB)|M|uncommon|orange/blue/blue|marble|blue
Sunshine Peacock|Aulonocara stuartgranti|M|uncommon|yellow/blue/yellow|none|
Red Empress|Protomelas taeniolatus|L|uncommon|red/blue/blue|split|blue
Dragon Blood Peacock|Aulonocara (dragon blood)|M|rare|pink/orange/red|spots|red
Blue Dolphin Cichlid|Cyrtocara moorii|L|uncommon|blue/cyan/blue|none|
Venustus|Nimbochromis venustus|L|uncommon|gold/cream/blue|marble|brown|P
Livingstonii|Nimbochromis livingstonii|L|uncommon|tan/white/blue|marble|brown|P
Fossorochromis rostratus|Fossorochromis rostratus|L|rare|tan/cream/blue|spots|brown
Electric Yellow Peacock|Aulonocara baenschi|M|uncommon|yellow/blue/yellow|none|
Frontosa|Cyphotilapia frontosa|L|rare|white/white/blue|vbands|black|P
Blue Zaire Frontosa|Cyphotilapia gibberosa (Zaire)|L|epic|blue/white/blue|vbands|navy|P
Tropheus Moorii|Tropheus moorii|M|rare|black/black/red|split|red
Calvus Cichlid|Altolamprologus calvus|M|rare|black/gray/black|spots|white
Compressiceps|Altolamprologus compressiceps|M|rare|tan/cream/tan|vbands|brown
Julidochromis regani|Julidochromis regani|M|uncommon|gold/cream/gold|hstripes|black
Julidochromis marlieri|Julidochromis marlieri|M|uncommon|cream/white/cream|marble|black
Cyprichromis leptosoma|Cyprichromis leptosoma|M|rare|blue/silver/yellow|none|
Featherfin Cichlid|Cyathopharynx furcifer|L|rare|teal/blue/gold|none|
Lemon Jake Peacock|Aulonocara korneliae|M|rare|yellow/blue/yellow|none|
Haplochromis Obliquidens|Haplochromis latifasciatus|M|uncommon|red/yellow/red|vbands|black
Mbuna Hongi|Labeotropheus trewavasae|M|uncommon|blue/navy/orange|none|
Buttikoferi|Heterotilapia buttikoferi|XL|rare|cream/white/gray|vbands|black|A
Jewel Cichlid|Hemichromis bimaculatus|M|common|red/red/red|spots|cyan|A
`
	},
	{
		head: 'fresh tropical fish rock,sand,wood',
		lines: `
Oscar|Astronotus ocellatus|L|uncommon|black/brown/black|marble|orange|P
Tiger Oscar|Astronotus ocellatus (tiger)|L|uncommon|black/brown/black|vbands|orange|P
Albino Oscar|Astronotus ocellatus (albino)|L|uncommon|white/white/white|marble|orange|P
Lemon Oscar|Astronotus ocellatus (lemon)|L|rare|yellow/cream/yellow|marble|orange|P
Severum|Heros severus|L|common|gold/green/gold|vbands|brown
Gold Severum|Heros severus (gold)|L|common|gold/yellow/orange|none|
Convict Cichlid|Amatitlania nigrofasciata|M|common|gray/silver/gray|vbands|black|A
Pink Convict|Amatitlania nigrofasciata (pink)|M|common|pink/white/pink|none||A
Firemouth Cichlid|Thorichthys meeki|M|common|gray/red/teal|vbands|black
Jack Dempsey|Rocio octofasciata|L|common|black/navy/black|spots|cyan|P
Electric Blue Jack Dempsey|Rocio octofasciata (electric blue)|L|rare|cyan/blue/cyan|spots|white|P
Green Terror|Andinoacara rivulatus|L|uncommon|green/teal/orange|spots|cyan|P
Texas Cichlid|Herichthys cyanoguttatus|L|uncommon|gray/gray/gray|spots|cyan|P
Red Texas Cichlid|Herichthys hybrid|L|epic|red/red/red|spots|white|A
Flowerhorn Cichlid|Hybrid cichlid|L|rare|red/pink/red|spots|black|A
Kamfa Flowerhorn|Hybrid cichlid (kamfa)|L|ultra|orange/pink/red|spots|black|A
Blood Parrot Cichlid|Hybrid cichlid (blood parrot)|M|common|orange/orange/orange|none||-|puffy
Midas Cichlid|Amphilophus citrinellus|L|uncommon|orange/yellow/orange|none||A
Red Devil Cichlid|Amphilophus labiatus|L|uncommon|red/orange/red|none||A
Salvini Cichlid|Trichromis salvini|M|uncommon|gold/red/teal|hstripes|black|P
Uaru|Uaru amphiacanthoides|L|rare|tan/cream/tan|split|black
Geophagus Altifrons|Geophagus altifrons|L|uncommon|gold/cream/teal|hstripes|cyan
Red Head Tapajos|Geophagus sp. (Tapajos)|M|rare|gold/cream/red|spots|black
Peacock Bass|Cichla ocellaris|XL|rare|olive/yellow/orange|vbands|black|P
Wolf Cichlid|Parachromis dovii|XL|epic|gold/cream/teal|marble|black|A
Jaguar Cichlid|Parachromis managuensis|L|uncommon|cream/white/gold|spots|black|P
Pike Cichlid|Crenicichla saxatilis|L|uncommon|tan/cream/tan|hstripes|black|P
Chocolate Cichlid|Hypselecara temporalis|L|uncommon|brown/red/brown|none|
Festivum|Mesonauta festivus|M|uncommon|cream/gold/cream|hstripes|black|-|tall
Rainbow Cichlid|Herotilapia multispinosa|M|uncommon|gold/cream/orange|marble|black
`
	},
	{
		head: 'fresh tropical bottom sand',
		lines: `
Bronze Corydoras|Corydoras aeneus|S|common|tan/cream/tan|none|
Albino Corydoras|Corydoras aeneus (albino)|S|common|white/pink/white|none|
Panda Corydoras|Corydoras panda|S|uncommon|white/white/white|spots|black
Peppered Corydoras|Corydoras paleatus|S|common|olive/cream/olive|marble|black
Sterbai Corydoras|Corydoras sterbai|S|uncommon|black/cream/orange|spots|white
Julii Corydoras|Corydoras julii|S|uncommon|gray/white/gray|spots|black
Pygmy Corydoras|Corydoras pygmaeus|S|uncommon|silver/white/silver|hstripes|black
Habrosus Corydoras|Corydoras habrosus|S|uncommon|tan/cream/tan|marble|black
Emerald Green Corydoras|Corydoras splendens|M|uncommon|green/teal/green|none|
Adolfo's Corydoras|Corydoras adolfoi|S|rare|white/cream/white|split|black
Skunk Corydoras|Corydoras arcuatus|S|uncommon|cream/white/cream|hstripes|black
Bandit Corydoras|Corydoras metae|S|uncommon|cream/white/cream|vbands|black
Orange Laser Corydoras|Corydoras sp. CW010|S|ultra|green/cream/green|hstripes|orange
Similis Corydoras|Corydoras similis|S|rare|gray/cream/gray|spots|black
Gold Laser Corydoras|Corydoras sp. CW009|S|rare|teal/cream/teal|hstripes|gold
Leopard Corydoras|Corydoras trilineatus|S|common|cream/white/cream|spots|black
Pandurini Corydoras|Corydoras panduro|S|rare|tan/cream/tan|spots|black
Venezuelan Black Corydoras|Corydoras schultzei (black)|S|uncommon|black/black/black|none|
Super Sterbai Corydoras|Corydoras sterbai (gold)|S|rare|gold/cream/orange|spots|white
Weitzman's Corydoras|Corydoras weitzmani|S|epic|tan/cream/tan|vbands|black
Hastatus Corydoras|Corydoras hastatus|S|uncommon|silver/white/silver|spots|black
Duplicareus Corydoras|Corydoras duplicareus|S|rare|cream/white/cream|split|black
Kuhli Loach|Pangio kuhlii|S|common|orange/cream/orange|vbands|black|-|eel
Black Kuhli Loach|Pangio oblonga|S|uncommon|brown/brown/brown|none||-|eel
Otocinclus|Otocinclus vittatus|S|common|tan/white/tan|hstripes|black
`
	},
	{
		head: 'fresh tropical bottom cave,wood',
		lines: `
Bristlenose Pleco|Ancistrus cirrhosus|M|common|brown/tan/brown|spots|cream
Albino Bristlenose Pleco|Ancistrus sp. (albino)|M|common|cream/white/cream|none|
Super Red Bristlenose|Ancistrus sp. (super red)|M|rare|orange/orange/orange|none|
Calico Bristlenose|Ancistrus sp. (calico)|M|uncommon|orange/cream/orange|calico|black
Zebra Pleco|Hypancistrus zebra|S|ultra|white/white/white|zebra|black
Common Pleco|Pterygoplichthys pardalis|XL|common|brown/tan/brown|marble|black|-|bottom
Sailfin Pleco|Pterygoplichthys gibbiceps|XL|uncommon|tan/cream/tan|spots|brown
Gold Nugget Pleco|Baryancistrus xanthellus|M|rare|black/navy/gold|spots|gold
Royal Pleco|Panaque nigrolineatus|L|rare|gray/gray/gray|hstripes|black
Clown Pleco|Panaqolus maccus|S|uncommon|brown/tan/brown|vbands|gold
Rubber Lip Pleco|Chaetostoma milesi|M|uncommon|gray/cream/gray|spots|black
Queen Arabesque Pleco|Hypancistrus sp. L260|S|ultra|black/navy/black|marble|white
King Tiger Pleco|Hypancistrus sp. L066|S|rare|black/gray/black|marble|cream
Snowball Pleco|Hypancistrus inspector|M|rare|black/black/black|spots|white
Leopard Frog Pleco|Peckoltia compta|S|rare|gold/cream/gold|vbands|black
Blue Phantom Pleco|Hemiancistrus sp. L128|M|ultra|navy/blue/navy|spots|cyan
Vampire Pleco|Leporacanthicus galaxias|M|rare|black/gray/black|spots|white
Sunshine Pleco|Scobinancistrus aureatus|L|epic|black/navy/gold|spots|gold
Golden Nugget Pleco (Medium Spot)|Baryancistrus sp. L081|M|rare|black/navy/gold|spots|yellow
Butterfly Pleco|Dekeyseria brachyura|M|rare|tan/cream/tan|vbands|brown
Pitbull Pleco|Parotocinclus jumbo|S|uncommon|brown/cream/brown|spots|gold
Candy Striped Pleco|Peckoltia vittata|S|uncommon|gold/cream/gold|vbands|black
Mango Pleco|Baryancistrus chrysolomus|L|epic|black/gray/gold|spots|gold
L333 King Tiger|Hypancistrus sp. L333|S|ultra|cream/white/cream|marble|black
Scarlet Pleco|Pseudacanthicus sp. L025|XL|legendary|black/gray/red|spots|black|-|bottom
`
	},
	{
		head: 'fresh tropical bottom cave,sand',
		lines: `
Clown Loach|Chromobotia macracanthus|L|uncommon|orange/gold/red|vbands|black|-|fish
Yoyo Loach|Botia almorhae|M|common|silver/white/silver|zebra|black|-|fish
Zebra Loach|Botia striata|M|uncommon|cream/white/cream|zebra|brown|-|fish
Dwarf Chain Loach|Ambastaia sidthimunki|S|uncommon|gold/white/gold|marble|black|-|fish
Hillstream Loach|Sewellia lineolata|S|uncommon|gold/cream/gold|spots|black
Reticulated Hillstream Loach|Sewellia lineolata|S|rare|tan/cream/tan|marble|black
Dojo Loach|Misgurnus anguillicaudatus|M|common|tan/cream/tan|spots|brown|-|eel
Golden Dojo Loach|Misgurnus anguillicaudatus (gold)|M|common|gold/yellow/gold|none||-|eel
Skunk Loach|Yasuhikotakia morleti|M|uncommon|cream/white/cream|hstripes|black|-|fish
Polka Dot Loach|Botia kubotai|M|rare|gold/white/gold|marble|black|-|fish
Horseface Loach|Acantopsis dialuzona|M|uncommon|tan/cream/tan|spots|brown|-|eel
Bumblebee Catfish|Microglanis iheringi|S|uncommon|gold/cream/gold|vbands|black
Pictus Catfish|Pimelodus pictus|M|common|silver/white/silver|spots|black
Upside-down Catfish|Synodontis nigriventris|M|uncommon|tan/brown/tan|spots|brown
Cuckoo Catfish|Synodontis multipunctatus|M|rare|cream/white/cream|spots|black
Polka Dot Synodontis|Synodontis angelicus|M|ultra|black/navy/black|spots|white
Glass Catfish|Kryptopterus vitreolus|S|uncommon|silver/white/silver|none||-|fish
Striped Raphael Catfish|Platydoras armatulus|M|uncommon|black/white/black|hstripes|white
Twig Catfish|Farlowella acus|M|rare|tan/cream/tan|hstripes|brown|-|eel
Banjo Catfish|Bunocephalus coracoideus|M|rare|brown/tan/brown|marble|black
Red Tail Catfish|Phractocephalus hemioliopterus|XXL|epic|black/white/red|split|white|P
Iridescent Shark|Pangasianodon hypophthalmus|XL|common|silver/white/gray|hstripes|gray|P|shark
Tiger Shovelnose Catfish|Pseudoplatystoma fasciatum|XL|rare|tan/white/tan|vbands|black|P|long
Asian Stone Catfish|Hara jerdoni|S|rare|brown/tan/brown|marble|black
Dwarf Petricola|Synodontis petricola|M|rare|cream/white/cream|spots|black
`
	},
	{
		head: 'fresh tropical fish plants',
		lines: `
Boesemani Rainbowfish|Melanotaenia boesemani|M|uncommon|blue/orange/orange|split|orange
Red Rainbowfish|Glossolepis incisus|M|uncommon|red/red/red|none|
Neon Dwarf Rainbowfish|Melanotaenia praecox|S|uncommon|blue/silver/red|none|
Turquoise Rainbowfish|Melanotaenia lacustris|M|uncommon|teal/blue/teal|none|
Threadfin Rainbowfish|Iriatherina werneri|S|rare|silver/gold/navy|vbands|gold
Forktail Blue-eye|Pseudomugil furcatus|S|uncommon|yellow/blue/yellow|none|
Celebes Rainbowfish|Marosatherina ladigesi|S|uncommon|gold/cream/gold|hstripes|cyan
Banded Rainbowfish|Melanotaenia trifasciata|M|rare|gold/red/red|hstripes|navy
Lake Kutubu Rainbowfish|Melanotaenia lacustris|M|uncommon|teal/silver/teal|hstripes|navy
Dwarf Neon Rainbowfish (Blue)|Melanotaenia praecox|S|uncommon|blue/silver/blue|none|
Axelrod's Rainbowfish|Chilatherina axelrodi|M|rare|blue/silver/yellow|none|
Red Neon Blue-eye|Pseudomugil luminatus|S|rare|red/red/blue|none|
Spotted Blue-eye|Pseudomugil gertrudae|S|uncommon|gold/cream/gold|spots|black
Australian Rainbowfish|Melanotaenia splendida|M|common|silver/blue/red|hstripes|red
Goldie River Rainbowfish|Melanotaenia goldiei|M|uncommon|gold/silver/red|hstripes|blue
Clown Killifish|Epiplatys annulatus|S|uncommon|cream/white/blue|vbands|black
Blue Gularis|Fundulopanchax sjostedti|M|rare|blue/orange/red|spots|red
Gardneri Killifish|Fundulopanchax gardneri|S|uncommon|blue/gold/gold|spots|red
Lyretail Killifish|Aphyosemion australe|S|uncommon|orange/gold/orange|spots|red
Golden Wonder Killifish|Aplocheilus lineatus|M|uncommon|gold/cream/gold|spots|black|P
Rachovii Killifish|Nothobranchius rachovii|S|rare|blue/orange/red|marble|red
Eggersi Killifish|Nothobranchius eggersi|S|rare|red/blue/red|none|
Bluefin Notho|Nothobranchius rachovii|S|rare|blue/red/blue|marble|red
American Flagfish|Jordanella floridae|S|uncommon|olive/cream/red|hstripes|red
`
	},
	{
		head: 'fresh tropical long sand,light',
		lines: `
Silver Arowana|Osteoglossum bicirrhosum|XL|epic|silver/white/silver|none||P
Black Arowana|Osteoglossum ferreirai|XL|epic|navy/silver/navy|none||P
Jardini Arowana|Scleropages jardinii|XL|epic|gold/cream/gold|spots|red|P
Super Red Arowana|Scleropages formosus|XL|epic|red/orange/red|none||P
Golden Arowana|Scleropages formosus (gold)|XL|epic|gold/yellow/gold|none||P
Platinum Arowana|Scleropages formosus (platinum)|XL|legendary|white/white/white|none||P
Albino Silver Arowana|Osteoglossum bicirrhosum (albino)|XL|legendary|white/pink/white|none||P
Florida Gar|Lepisosteus platyrhincus|XL|uncommon|olive/cream/olive|spots|brown|P
Spotted Gar|Lepisosteus oculatus|XL|uncommon|tan/cream/tan|spots|brown|P
Alligator Gar|Atractosteus spatula|XXL|rare|olive/cream/olive|spots|brown|P
Albino Alligator Gar|Atractosteus spatula (albino)|XXL|legendary|white/white/pink|none||P
Platinum Alligator Gar|Atractosteus spatula (platinum)|XXL|legendary|silver/white/silver|none||P
Senegal Bichir|Polypterus senegalus|L|common|gray/cream/gray|none||P
Ornate Bichir|Polypterus ornatipinnis|XL|rare|brown/cream/brown|marble|white|P
Albino Senegal Bichir|Polypterus senegalus (albino)|L|uncommon|white/white/white|none||P
Saddled Bichir|Polypterus endlicherii|XL|rare|tan/cream/tan|vbands|brown|P
Ropefish|Erpetoichthys calabaricus|L|uncommon|olive/cream/olive|none||P|eel
Black Ghost Knifefish|Apteronotus albifrons|L|uncommon|black/black/black|none||P
Clown Knifefish|Chitala ornata|XL|uncommon|silver/white/silver|spots|black|P
Elephantnose Fish|Gnathonemus petersii|M|rare|brown/cream/brown|vbands|white
African Butterfly Fish|Pantodon buchholzi|M|uncommon|tan/cream/tan|marble|brown|P
Fire Eel|Mastacembelus erythrotaenia|XL|rare|black/brown/black|hstripes|red|P|eel
Peacock Eel|Macrognathus siamensis|L|uncommon|tan/cream/tan|spots|black||eel
Tire Track Eel|Mastacembelus armatus|XL|uncommon|brown/tan/brown|marble|black|P|eel
Freshwater Needlefish|Xenentodon cancila|L|uncommon|silver/white/green|none||P
Archerfish|Toxotes jaculatrix|L|rare|silver/white/silver|vbands|black|P|fish
Leaf Fish|Monocirrhus polyacanthus|M|rare|brown/tan/brown|marble|olive|P|fish
Asian Leaf Fish|Nandus nandus|M|uncommon|olive/tan/olive|marble|brown|P|fish
Rainbow Snakehead|Channa bleheri|M|rare|navy/red/red|spots|red|A|fish
Dwarf Snakehead|Channa gachua|M|uncommon|olive/cream/orange|marble|black|A|fish
Bullseye Snakehead|Channa marulius|XXL|epic|gray/cream/gray|spots|black|P|fish
Arapaima|Arapaima gigas|XXL|legendary|gray/cream/red|marble|red|P
Datnoid (Siamese Tigerfish)|Datnioides pulcher|L|epic|gold/cream/gold|vbands|black|P|fish
Wolf Fish|Hoplias malabaricus|L|rare|olive/cream/olive|marble|brown|P|fish
Pacu|Piaractus brachypomus|XL|uncommon|gray/red/gray|none||-|fish
Red-bellied Piranha|Pygocentrus nattereri|M|uncommon|silver/red/gray|spots|silver|P|fish
`
	},
	{
		head: 'fresh tropical ray sand',
		lines: `
Motoro Stingray|Potamotrygon motoro|L|ultra|brown/cream/brown|spots|orange|P
Polka Dot Stingray|Potamotrygon leopoldi|L|epic|black/cream/black|spots|white|P
Pearl Stingray|Potamotrygon jabuti|L|epic|black/cream/black|spots|cream|P
Teacup Stingray|Potamotrygon schroederi|M|ultra|brown/cream/brown|spots|black|P
Black Diamond Stingray|Potamotrygon leopoldi (black diamond)|L|legendary|black/cream/black|spots|white|P
Tiger River Stingray|Potamotrygon menchacai|L|legendary|brown/cream/brown|zebra|gold|P
Reticulated Stingray|Potamotrygon reticulata|L|epic|tan/cream/tan|marble|brown|P
`
	},
	{
		head: 'fresh tropical puffy plants,sand',
		lines: `
Pea Puffer|Carinotetraodon travancoricus|S|uncommon|yellow/white/yellow|spots|olive|S
Red-tail Dwarf Puffer|Carinotetraodon irrubesco|S|rare|olive/cream/red|marble|brown|S
Fahaka Puffer|Tetraodon lineatus|L|rare|olive/cream/olive|hstripes|gold|A
Mbu Puffer|Tetraodon mbu|XL|epic|olive/cream/olive|marble|black|A
South American Puffer|Colomesus asellus|S|uncommon|gold/white/gold|vbands|black
Figure Eight Puffer|Dichotomyctere ocellatus|M|uncommon|olive/white/olive|marble|gold|S
Green Spotted Puffer|Dichotomyctere nigroviridis|M|common|green/white/green|spots|black|S
`
	},
	{
		head: 'fresh cold fish gravel,plants',
		lines: `
White Cloud Minnow|Tanichthys albonubes|S|common|tan/cream/red|hstripes|gold
Gold White Cloud Minnow|Tanichthys albonubes (gold)|S|common|gold/cream/red|hstripes|white
Rosy Red Minnow|Pimephales promelas (rosy red)|S|common|pink/cream/pink|none|
Rainbow Darter|Etheostoma caeruleum|S|rare|blue/orange/red|vbands|teal
Bluegill|Lepomis macrochirus|M|common|olive/gold/olive|vbands|navy|P
Pumpkinseed Sunfish|Lepomis gibbosus|M|common|olive/orange/olive|marble|cyan|P
Longear Sunfish|Lepomis megalotis|M|uncommon|orange/red/orange|marble|cyan|P
Black-banded Sunfish|Enneacanthus chaetodon|S|rare|silver/white/silver|vbands|black
Three-spined Stickleback|Gasterosteus aculeatus|S|uncommon|olive/red/olive|none|
Weather Loach|Misgurnus anguillicaudatus|M|common|tan/cream/tan|spots|brown||eel
Golden Orfe|Leuciscus idus (gold)|L|uncommon|orange/gold/orange|none|
Bitterling|Rhodeus amarus|S|uncommon|silver/pink/red|hstripes|teal
Rudd|Scardinius erythrophthalmus|M|common|gold/silver/red|none|
Chinese Hi-fin Banded Shark|Myxocyprinus asiaticus|XL|rare|tan/cream/black|vbands|brown||tall
Sterlet|Acipenser ruthenus|XL|rare|gray/cream/gray|none||-|shark
`
	},
	{
		head: 'fresh cold puffy gravel,bubbles',
		lines: `
Comet Goldfish|Carassius auratus (comet)|L|common|orange/gold/orange|none||-|fish
Common Goldfish|Carassius auratus|L|common|orange/gold/orange|none||-|fish
Shubunkin|Carassius auratus (shubunkin)|L|common|blue/white/blue|calico|orange|-|fish
Fancy Goldfish|Carassius auratus (fantail)|M|common|orange/gold/orange|none|
Oranda|Carassius auratus (oranda)|M|common|orange/gold/orange|none|
Red Cap Oranda|Carassius auratus (red cap oranda)|M|uncommon|white/white/white|split|red
Ryukin|Carassius auratus (ryukin)|M|common|orange/white/orange|calico|white
Ranchu|Carassius auratus (ranchu)|M|rare|red/white/red|calico|white
Lionhead Goldfish|Carassius auratus (lionhead)|M|uncommon|orange/gold/orange|none|
Black Moor|Carassius auratus (black moor)|M|common|black/black/black|none|
Telescope Eye Goldfish|Carassius auratus (telescope)|M|uncommon|black/gold/black|calico|orange
Pearlscale Goldfish|Carassius auratus (pearlscale)|M|uncommon|orange/white/orange|spots|white
Bubble Eye Goldfish|Carassius auratus (bubble eye)|M|rare|orange/gold/orange|none|
Celestial Eye Goldfish|Carassius auratus (celestial)|M|rare|orange/gold/orange|none|
Pompom Goldfish|Carassius auratus (pompom)|M|rare|red/white/red|calico|white
Veiltail Goldfish|Carassius auratus (veiltail)|M|uncommon|orange/white/orange|calico|white
Butterfly Tail Goldfish|Carassius auratus (butterfly)|M|rare|black/white/black|calico|orange
Tamasaba|Carassius auratus (tamasaba)|M|rare|red/white/red|split|white
Wakin|Carassius auratus (wakin)|L|uncommon|red/white/red|calico|white|-|fish
Jikin|Carassius auratus (jikin)|M|ultra|white/white/red|split|red
Panda Oranda|Carassius auratus (panda)|M|rare|white/white/black|calico|black
Tosakin|Carassius auratus (tosakin)|M|epic|red/orange/red|none|
Calico Ryukin|Carassius auratus (calico ryukin)|M|uncommon|white/blue/white|calico|orange
Chocolate Oranda|Carassius auratus (chocolate)|M|uncommon|brown/tan/brown|none|
Lionchu|Carassius auratus (lionchu)|M|ultra|red/orange/red|calico|white
`
	},
	{
		head: 'fresh cold fish rock,bubbles',
		lines: `
Koi|Cyprinus rubrofuscus|L|uncommon|white/white/white|calico|red
Kohaku Koi|Cyprinus rubrofuscus (kohaku)|L|uncommon|white/white/white|calico|red
Taisho Sanke Koi|Cyprinus rubrofuscus (sanke)|L|rare|white/white/white|calico|red
Showa Koi|Cyprinus rubrofuscus (showa)|L|rare|black/white/black|calico|red
Tancho Koi|Cyprinus rubrofuscus (tancho)|L|ultra|white/white/white|split|red
Ogon Koi|Cyprinus rubrofuscus (ogon)|L|uncommon|gold/yellow/gold|none|
Platinum Ogon Koi|Cyprinus rubrofuscus (platinum ogon)|L|rare|white/silver/white|none|
Asagi Koi|Cyprinus rubrofuscus (asagi)|L|rare|blue/orange/blue|marble|navy
Shusui Koi|Cyprinus rubrofuscus (shusui)|L|rare|blue/orange/blue|spots|navy
Utsuri Koi|Cyprinus rubrofuscus (utsuri)|L|rare|black/white/black|calico|white
Bekko Koi|Cyprinus rubrofuscus (bekko)|L|uncommon|white/white/white|spots|black
Goshiki Koi|Cyprinus rubrofuscus (goshiki)|L|rare|navy/white/red|marble|red
Kujaku Koi|Cyprinus rubrofuscus (kujaku)|L|ultra|white/gold/orange|marble|gold
Chagoi Koi|Cyprinus rubrofuscus (chagoi)|L|uncommon|brown/tan/brown|none|
Soragoi Koi|Cyprinus rubrofuscus (soragoi)|L|uncommon|gray/silver/gray|none|
Doitsu Kohaku|Cyprinus rubrofuscus (doitsu)|L|rare|white/white/white|calico|red
Ochiba Koi|Cyprinus rubrofuscus (ochiba)|L|rare|gray/silver/gray|marble|orange
Kin Gin Rin Kohaku|Cyprinus rubrofuscus (gin rin)|L|epic|white/silver/white|calico|red
Butterfly Koi|Cyprinus rubrofuscus (longfin)|L|uncommon|orange/gold/orange|calico|white
Benigoi Koi|Cyprinus rubrofuscus (benigoi)|L|uncommon|red/orange/red|none|
Champion Tancho Showa|Cyprinus rubrofuscus (tancho showa)|L|legendary|black/white/black|calico|red
`
	},
	{
		head: 'salt tropical fish anemone,coral',
		lines: `
Ocellaris Clownfish|Amphiprion ocellaris|S|common|orange/orange/orange|vbands|white
Percula Clownfish|Amphiprion percula|S|common|orange/orange/orange|vbands|white
Black Ice Clownfish|Amphiprion ocellaris (black ice)|S|ultra|brown/brown/brown|vbands|white
Snowflake Clownfish|Amphiprion ocellaris (snowflake)|S|rare|orange/orange/orange|marble|white
Picasso Clownfish|Amphiprion percula (Picasso)|S|rare|orange/orange/orange|marble|white
Platinum Clownfish|Amphiprion percula (platinum)|S|epic|white/white/orange|none|
Frostbite Clownfish|Amphiprion ocellaris (frostbite)|S|ultra|orange/white/orange|marble|white
Black Ocellaris Clownfish|Amphiprion ocellaris (black)|S|uncommon|black/black/black|vbands|white
Naked Clownfish|Amphiprion ocellaris (naked)|S|rare|orange/orange/orange|none|
Misbar Clownfish|Amphiprion ocellaris (misbar)|S|uncommon|orange/orange/orange|vbands|white
Midnight Clownfish|Amphiprion ocellaris (midnight)|S|epic|black/black/black|none|
Lightning Maroon Clownfish|Premnas biaculeatus (lightning)|M|legendary|darkred/red/darkred|marble|white|S
Maroon Clownfish|Premnas biaculeatus|M|uncommon|darkred/red/darkred|vbands|gold|S
Gold Stripe Maroon Clownfish|Premnas biaculeatus (gold stripe)|M|rare|darkred/red/darkred|vbands|gold|S
Clarkii Clownfish|Amphiprion clarkii|S|common|brown/orange/orange|vbands|white
Tomato Clownfish|Amphiprion frenatus|S|common|red/red/red|vbands|white
Pink Skunk Clownfish|Amphiprion perideraion|S|uncommon|pink/pink/pink|hstripes|white
Orange Skunk Clownfish|Amphiprion sandaracinos|S|rare|orange/orange/orange|hstripes|white
Saddleback Clownfish|Amphiprion polymnus|S|rare|brown/orange/brown|vbands|white
Mocha Storm Clownfish|Amphiprion ocellaris (mocha storm)|S|epic|brown/tan/brown|marble|white
Wyoming White Clownfish|Amphiprion ocellaris (Wyoming white)|S|ultra|white/white/orange|none|
`
	},
	{
		head: 'salt tropical fish coral,rock',
		lines: `
Blue Damselfish|Chrysiptera cyanea|S|common|blue/blue/blue|none|
Yellowtail Blue Damsel|Chrysiptera parasema|S|common|blue/blue/yellow|split|yellow
Three-stripe Damselfish|Dascyllus aruanus|S|common|white/white/white|vbands|black
Domino Damselfish|Dascyllus trimaculatus|S|common|black/black/black|spots|white
Yellow-tail Damselfish|Chrysiptera parasema|S|common|blue/blue/blue|split|yellow
Azure Damselfish|Chrysiptera hemicyanea|S|common|blue/yellow/yellow|split|yellow
Green Chromis|Chromis viridis|S|common|teal/green/teal|none|
Blue Reef Chromis|Chromis cyanea|S|uncommon|blue/navy/blue|none|
Springer's Damselfish|Chrysiptera springeri|S|uncommon|blue/navy/blue|hstripes|black
Starck's Damselfish|Chrysiptera starcki|S|rare|blue/yellow/yellow|split|yellow
Talbot's Damselfish|Chrysiptera talboti|S|uncommon|yellow/white/yellow|spots|black
Garibaldi Damselfish|Hypsypops rubicundus|M|ultra|orange/orange/orange|none||S
`
	},
	{
		head: 'salt tropical tall rock,coral',
		lines: `
Yellow Tang|Zebrasoma flavescens|M|common|yellow/yellow/yellow|none|
Blue Tang|Paracanthurus hepatus|L|uncommon|blue/blue/yellow|marble|navy
Purple Tang|Zebrasoma xanthurum|M|rare|purple/violet/yellow|none|
Sailfin Tang|Zebrasoma veliferum|L|uncommon|tan/cream/tan|vbands|brown
Desjardini Tang|Zebrasoma desjardinii|L|uncommon|tan/cream/tan|hstripes|gold
Kole Tang|Ctenochaetus strigosus|M|common|brown/tan/brown|none|
Powder Blue Tang|Acanthurus leucosternon|M|uncommon|blue/cyan/yellow|split|black
Achilles Tang|Acanthurus achilles|M|rare|black/navy/black|spots|orange
Naso Tang|Naso lituratus|L|uncommon|gray/tan/orange|none|
Scopas Tang|Zebrasoma scopas|M|common|brown/tan/brown|none|
Gem Tang|Zebrasoma gemmatum|M|legendary|black/navy/black|spots|white
Clown Tang|Acanthurus lineatus|L|rare|blue/white/blue|hstripes|gold
Tomini Tang|Ctenochaetus tominiensis|M|uncommon|brown/tan/white|none|
Convict Tang|Acanthurus triostegus|M|common|cream/white/cream|vbands|black
Orange Shoulder Tang|Acanthurus olivaceus|L|uncommon|gray/tan/gray|split|orange
Chevron Tang|Ctenochaetus hawaiiensis|M|ultra|orange/orange/orange|hstripes|navy
Black Tang|Zebrasoma rostratum|M|epic|black/black/black|none|
Lipstick Tang|Naso elegans|L|uncommon|gray/cream/orange|none|
`
	},
	{
		head: 'salt tropical tall rock,cave',
		lines: `
Flame Angelfish|Centropyge loricula|S|uncommon|red/orange/navy|vbands|black
Coral Beauty Angelfish|Centropyge bispinosa|S|common|navy/orange/navy|marble|orange
Lemonpeel Angelfish|Centropyge flavissima|S|uncommon|yellow/yellow/yellow|none|
Potter's Angelfish|Centropyge potteri|S|rare|orange/blue/orange|marble|navy
Bicolor Angelfish|Centropyge bicolor|S|common|yellow/yellow/navy|split|navy
Cherub Angelfish|Centropyge argi|S|uncommon|navy/blue/navy|split|orange
Rusty Angelfish|Centropyge ferrugata|S|uncommon|brown/orange/brown|spots|navy
Eibli Angelfish|Centropyge eibli|S|uncommon|gray/cream/gray|vbands|orange
Multicolor Angelfish|Centropyge multicolor|S|rare|white/yellow/navy|split|navy
Joculator Angelfish|Centropyge joculator|S|epic|yellow/yellow/navy|split|navy
Resplendent Angelfish|Centropyge resplendens|S|ultra|navy/blue/yellow|split|yellow
Peppermint Angelfish|Centropyge boylei|S|legendary|red/orange/white|vbands|white
Golden Angelfish|Centropyge aurantia|S|legendary|gold/yellow/gold|none|
Interruptus Angelfish|Centropyge interruptus|S|epic|orange/orange/navy|spots|navy
Venustus Angelfish|Paracentropyge venusta|S|epic|purple/yellow/purple|split|yellow
Emperor Angelfish|Pomacanthus imperator|L|rare|blue/blue/yellow|hstripes|yellow|-|tall
Queen Angelfish|Holacanthus ciliaris|L|rare|blue/yellow/yellow|marble|navy|-|tall
French Angelfish|Pomacanthus paru|L|uncommon|black/black/black|spots|yellow|-|tall
Majestic Angelfish|Pomacanthus navarchus|L|rare|navy/orange/orange|split|orange|-|tall
Regal Angelfish|Pygoplites diacanthus|M|ultra|orange/orange/navy|vbands|white
Blueface Angelfish|Pomacanthus xanthometopon|L|rare|navy/yellow/yellow|marble|blue|-|tall
Koran Angelfish|Pomacanthus semicirculatus|L|uncommon|navy/navy/navy|vbands|white|-|tall
Clarion Angelfish|Holacanthus clarionensis|M|legendary|orange/orange/navy|vbands|navy
Rock Beauty Angelfish|Holacanthus tricolor|M|uncommon|yellow/yellow/black|split|black
Bandit Angelfish|Apolemichthys arcuatus|M|epic|white/gray/white|split|black
Masked Angelfish|Genicanthus personatus|M|legendary|white/white/white|split|orange
Lamarck's Angelfish|Genicanthus lamarck|M|uncommon|white/white/white|hstripes|black
`
	},
	{
		head: 'salt tropical tall coral',
		lines: `
Copperband Butterflyfish|Chelmon rostratus|M|rare|white/white/white|vbands|orange
Raccoon Butterflyfish|Chaetodon lunula|M|uncommon|yellow/yellow/yellow|split|black
Threadfin Butterflyfish|Chaetodon auriga|M|uncommon|white/white/yellow|marble|navy
Longnose Butterflyfish|Forcipiger flavissimus|M|uncommon|yellow/yellow/yellow|split|black
Pyramid Butterflyfish|Hemitaurichthys polylepis|M|uncommon|yellow/white/yellow|split|white
Pearlscale Butterflyfish|Chaetodon xanthurus|M|uncommon|gray/white/orange|marble|black
Tinker's Butterflyfish|Chaetodon tinkeri|M|epic|white/white/yellow|split|black
Heniochus Butterflyfish|Heniochus diphreutes|M|common|white/white/yellow|vbands|black
Moorish Idol|Zanclus cornutus|M|ultra|white/white/yellow|vbands|black
Saddleback Butterflyfish|Chaetodon ephippium|M|rare|yellow/white/orange|split|black
Bannerfish (Pennant)|Heniochus acuminatus|M|common|white/white/yellow|vbands|black
Klein's Butterflyfish|Chaetodon kleinii|M|common|gold/white/gold|vbands|navy
`
	},
	{
		head: 'salt tropical fish rock,sand',
		lines: `
Six-line Wrasse|Pseudocheilinus hexataenia|S|common|purple/blue/purple|hstripes|orange
Fairy Wrasse|Cirrhilabrus solorensis|S|uncommon|red/blue/red|none|
McCosker's Flasher Wrasse|Paracheilinus mccoskeri|S|uncommon|orange/red/blue|hstripes|blue
Carpenter's Flasher Wrasse|Paracheilinus carpenteri|S|rare|red/orange/red|hstripes|violet
Melanurus Wrasse|Halichoeres melanurus|M|common|blue/orange/blue|hstripes|orange
Yellow Coris Wrasse|Halichoeres chrysus|M|common|yellow/yellow/yellow|spots|black
Christmas Wrasse|Halichoeres ornatissimus|M|uncommon|green/red/green|marble|red
Leopard Wrasse|Macropharyngodon meleagris|M|rare|gold/cream/gold|spots|navy
Cleaner Wrasse|Labroides dimidiatus|S|common|blue/white/blue|hstripes|black
Bird Wrasse|Gomphosus varius|L|uncommon|green/teal/green|none||P
Harlequin Tuskfish|Choerodon fasciatus|L|rare|orange/white/orange|vbands|navy|P
Lyretail Fairy Wrasse|Cirrhilabrus lubbocki|S|rare|orange/violet/red|split|violet
Exquisite Fairy Wrasse|Cirrhilabrus exquisitus|S|rare|green/red/red|split|blue
Rhomboid Fairy Wrasse|Cirrhilabrus rhomboidalis|S|epic|violet/yellow/violet|split|yellow
Clown Coris Wrasse|Coris gaimard|L|uncommon|red/orange/blue|spots|cyan
Radiant Wrasse|Halichoeres iridis|M|uncommon|orange/yellow/orange|split|yellow
Possum Wrasse|Wetmorella nigropinnata|S|rare|brown/orange/brown|vbands|white
Yellow Tail Tamarin Wrasse|Anampses meleagrides|M|rare|black/navy/yellow|spots|white
Rose-band Wrasse|Cirrhilabrus roseafascia|M|ultra|pink/violet/pink|hstripes|red
Bluehead Wrasse|Thalassoma bifasciatum|M|common|green/teal/blue|split|navy
`
	},
	{
		head: 'salt tropical bottom sand,rock',
		lines: `
Firefish Goby|Nemateleotris magnifica|S|common|white/white/red|split|red|-|fish
Purple Firefish|Nemateleotris decora|S|uncommon|white/violet/purple|split|purple|-|fish
Helfrich's Firefish|Nemateleotris helfrichi|S|epic|pink/yellow/violet|split|yellow|-|fish
Yellow Watchman Goby|Cryptocentrus cinctus|S|common|yellow/yellow/yellow|spots|cyan
Diamond Goby|Valenciennea puellaris|M|common|white/cream/white|spots|orange
Clown Goby|Gobiodon okinawae|S|uncommon|yellow/yellow/yellow|none|
Neon Goby|Elacatinus oceanops|S|common|black/white/black|neon|cyan
Mandarin Dragonet|Synchiropus splendidus|S|rare|blue/orange/teal|marble|orange
Spotted Mandarin|Synchiropus picturatus|S|rare|green/orange/green|spots|black
Red Scooter Blenny|Synchiropus stellatus|S|uncommon|red/cream/red|marble|white
Rainford's Goby|Amblygobius rainfordi|S|uncommon|tan/cream/tan|hstripes|orange
Blue-band Goby|Valenciennea strigata|M|common|white/cream/yellow|split|cyan
Randall's Shrimp Goby|Amblyeleotris randalli|S|uncommon|white/white/yellow|vbands|orange
Catalina Goby|Lythrypnus dalli|S|uncommon|red/red/red|vbands|cyan
Hi-fin Red Banded Goby|Stonogobiops nematodes|S|rare|white/white/white|vbands|red
Lawnmower Blenny|Salarias fasciatus|M|common|olive/cream/olive|marble|brown
Bicolor Blenny|Ecsenius bicolor|S|common|navy/orange/orange|split|orange
Midas Blenny|Ecsenius midas|S|uncommon|gold/yellow/gold|none|
Tailspot Blenny|Ecsenius stigmatura|S|uncommon|tan/white/tan|spots|black
Starry Blenny|Salarias ramosus|M|uncommon|brown/tan/brown|spots|white
Yellow Head Jawfish|Opistognathus aurifrons|S|uncommon|white/cream/yellow|split|yellow
Blue Spotted Jawfish|Opistognathus rosenblatti|S|epic|gold/tan/gold|spots|cyan
Dusky Jawfish|Opistognathus whitehursti|S|uncommon|brown/tan/brown|marble|black
`
	},
	{
		head: 'salt tropical fish cave,rock',
		lines: `
Royal Gramma|Gramma loreto|S|uncommon|purple/purple/yellow|split|yellow
Blackcap Basslet|Gramma melacara|S|rare|purple/violet/purple|split|black
Orchid Dottyback|Pseudochromis fridmani|S|uncommon|violet/purple/violet|none|
Bicolor Dottyback|Pictichromis paccagnellae|S|common|purple/yellow/yellow|split|yellow
Sunrise Dottyback|Pseudochromis flavivertex|S|uncommon|blue/navy/yellow|split|yellow
Springer's Dottyback|Pseudochromis springeri|S|uncommon|black/navy/black|hstripes|cyan
Neon Dottyback|Pseudochromis aldabraensis|S|uncommon|orange/orange/orange|hstripes|cyan
Golden Basslet|Liopropoma aberrans|S|legendary|gold/yellow/gold|none|
Swissguard Basslet|Liopropoma rubre|S|epic|red/orange/red|hstripes|gold
Candy Basslet|Liopropoma carmabi|S|legendary|pink/orange/pink|hstripes|violet
Bartlett's Anthias|Pseudanthias bartlettorum|S|rare|purple/yellow/yellow|split|yellow
Lyretail Anthias|Pseudanthias squamipinnis|M|common|orange/pink/orange|none|
Squareback Anthias|Pseudanthias pleurotaenia|M|rare|pink/orange/violet|spots|violet
Purple Queen Anthias|Pseudanthias tuka|M|rare|purple/violet/yellow|none|
Dispar Anthias|Pseudanthias dispar|S|uncommon|orange/pink/red|none|
Ventralis Anthias|Pseudanthias ventralis|S|epic|pink/yellow/violet|split|yellow
Pajama Cardinalfish|Sphaeramia nematoptera|S|common|gold/white/gold|spots|red|-|tall
Banggai Cardinalfish|Pterapogon kauderni|S|uncommon|silver/white/silver|vbands|black|-|tall
Flame Cardinalfish|Apogon maculatus|S|uncommon|red/orange/red|none|
Flame Hawkfish|Neocirrhites armatus|S|uncommon|red/red/red|split|black|P
Longnose Hawkfish|Oxycirrhites typus|S|uncommon|white/white/white|marble|red|P
Arc-eye Hawkfish|Paracirrhites arcatus|S|common|tan/cream/tan|hstripes|orange|P
Falco Hawkfish|Cirrhitichthys falco|S|common|white/white/white|vbands|red|P
`
	},
	{
		head: 'salt tropical tall rock,sand',
		lines: `
Picasso Triggerfish|Rhinecanthus aculeatus|M|uncommon|tan/cream/blue|split|blue|P
Niger Triggerfish|Odonus niger|L|common|navy/blue/navy|none||P
Clown Triggerfish|Balistoides conspicillum|L|rare|black/black/black|spots|white|A
Blue Jaw Triggerfish|Xanthichthys auromarginatus|M|rare|blue/gray/navy|none||P
Crosshatch Triggerfish|Xanthichthys mento|M|epic|navy/blue/red|marble|black|P
Pinktail Triggerfish|Melichthys vidua|L|uncommon|brown/navy/pink|none||P
Queen Triggerfish|Balistes vetula|L|rare|teal/yellow/blue|hstripes|blue|A
Bluethroat Triggerfish|Sufflamen albicaudatum|M|uncommon|brown/tan/blue|none||P
Orange-lined Triggerfish|Balistapus undulatus|L|uncommon|teal/green/orange|hstripes|orange|A
Undulated Triggerfish|Balistapus undulatus|L|uncommon|green/teal/orange|hstripes|orange|A
`
	},
	{
		head: 'salt tropical puffy rock,sand',
		lines: `
Dogface Puffer|Arothron nigropunctatus|L|uncommon|gray/white/gray|spots|black|S
Porcupine Puffer|Diodon holocanthus|L|uncommon|tan/white/tan|spots|brown|S
Valentini Puffer|Canthigaster valentini|S|common|white/white/yellow|vbands|black
Stars and Stripes Puffer|Arothron hispidus|L|uncommon|gray/white/gray|spots|white|S
Yellow Boxfish|Ostracion cubicus|M|uncommon|yellow/yellow/yellow|spots|black|S
Cowfish|Lactoria cornuta|M|uncommon|yellow/yellow/yellow|spots|blue|S
Blue Spotted Puffer|Canthigaster solandri|S|uncommon|orange/white/orange|spots|cyan
Spotted Boxfish|Ostracion meleagris|S|rare|navy/blue/navy|spots|white|S
`
	},
	{
		head: 'salt tropical lion cave,rock',
		lines: `
Red Lionfish|Pterois volitans|L|rare|white/white/red|vbands|darkred|P
Fu Manchu Lionfish|Dendrochirus biocellatus|S|rare|brown/cream/red|vbands|white|P
Dwarf Fuzzy Lionfish|Dendrochirus brachypterus|M|uncommon|brown/tan/brown|vbands|red|P
Radiata Lionfish|Pterois radiata|M|epic|brown/white/white|vbands|white|P
Antennata Lionfish|Pterois antennata|M|rare|tan/white/red|vbands|brown|P
Black Volitans Lionfish|Pterois volitans (black)|L|epic|black/gray/black|vbands|white|P
Leaf Scorpionfish|Taenianotus triacanthus|S|rare|gold/yellow/gold|marble|brown|P|tall
`
	},
	{
		head: 'salt tropical fish cave,rock',
		lines: `
Panther Grouper|Cromileptes altivelis|L|uncommon|white/white/white|spots|black|P
Coral Hind|Cephalopholis miniata|L|uncommon|red/orange/red|spots|cyan|P
Lyretail Grouper|Variola louti|XL|rare|red/orange/red|spots|violet|P
Miniatus Grouper|Cephalopholis miniata|L|uncommon|red/red/red|spots|cyan|P
Foxface Rabbitfish|Siganus vulpinus|M|uncommon|yellow/yellow/yellow|split|black|-|tall
One-spot Foxface|Siganus unimaculatus|M|rare|yellow/yellow/yellow|split|black|-|tall
Magnificent Rabbitfish|Siganus magnificus|M|rare|yellow/cream/yellow|split|black|-|tall
Orbiculate Batfish|Platax orbicularis|L|uncommon|silver/white/silver|vbands|black|-|disc
Pinnatus Batfish|Platax pinnatus|L|epic|black/navy/black|none||-|disc
Painted Frogfish|Antennarius pictus|M|rare|orange/orange/orange|spots|brown|P|puffy
Warty Frogfish|Antennarius maculatus|M|epic|white/pink/white|spots|red|P|puffy
Harlequin Filefish|Oxymonacanthus longirostris|S|rare|teal/green/teal|spots|orange|-|tall
Tassle Filefish|Chaetodermis penicilligerus|M|uncommon|tan/cream/tan|hstripes|brown|-|tall
Marine Betta|Calloplesiops altivelis|M|rare|navy/black/navy|spots|white|P|betta
Scribbled Rabbitfish|Siganus doliatus|M|uncommon|yellow/cream/blue|marble|blue|-|tall
`
	},
	{
		head: 'salt tropical eel cave,rock',
		lines: `
Snowflake Moray|Echidna nebulosa|L|rare|white/white/white|spots|black|P
Zebra Moray|Gymnomuraena zebra|XL|ultra|black/white/black|zebra|white|P
Dragon Moray|Enchelycore pardalis|L|legendary|orange/white/orange|spots|white|P
Ribbon Eel|Rhinomuraena quaesita|L|epic|blue/yellow/blue|none||P
Tessalata Moray|Gymnothorax favagineus|XL|rare|black/white/black|marble|white|P
Golden Moray|Gymnothorax miliaris|L|ultra|gold/yellow/gold|spots|navy|P
Green Moray|Gymnothorax funebris|XXL|rare|green/olive/green|none||P
Spotted Garden Eel|Heteroconger hassi|M|uncommon|white/white/white|spots|black
`
	},
	{
		head: 'salt tropical shark sand,cave',
		lines: `
Brownbanded Bamboo Shark|Chiloscyllium punctatum|XL|epic|tan/cream/tan|vbands|brown|P
White-spotted Bamboo Shark|Chiloscyllium plagiosum|XL|epic|brown/cream/brown|spots|white|P
Epaulette Shark|Hemiscyllium ocellatum|XL|epic|tan/cream/tan|spots|brown|P
Coral Catshark|Atelomycterus marmoratus|L|ultra|gray/white/gray|marble|black|P
Horn Shark|Heterodontus francisci|XL|ultra|tan/cream/tan|spots|black|P
Zebra Shark|Stegostoma tigrinum|XXL|epic|tan/cream/tan|spots|black
Blacktip Reef Shark|Carcharhinus melanopterus|XXL|legendary|gray/white/black|none||P
Whitetip Reef Shark|Triaenodon obesus|XXL|legendary|gray/white/white|none||P
Nurse Shark|Ginglymostoma cirratum|XXL|epic|tan/cream/tan|none||P
Wobbegong|Orectolobus maculatus|XXL|legendary|tan/cream/tan|marble|brown|P
Albino Bamboo Shark|Chiloscyllium punctatum (albino)|XL|legendary|white/white/white|vbands|cream|P
Leopard Shark|Triakis semifasciata|XXL|epic|gray/white/gray|spots|black|P
`
	},
	{
		head: 'salt tropical ray sand',
		lines: `
Blue Spotted Stingray|Taeniura lymma|L|epic|tan/cream/tan|spots|blue|P
Southern Stingray|Hypanus americanus|XXL|ultra|gray/white/gray|none||P
Yellow Stingray|Urobatis jamaicensis|L|rare|tan/cream/tan|marble|brown|P
Spotted Eagle Ray|Aetobatus narinari|XXL|legendary|navy/white/navy|spots|white|P
Blue Spotted Fantail Ray|Taeniura meyeni|XXL|epic|gray/white/gray|marble|black|P
`
	},
	{
		head: 'salt tropical tall coral,plants',
		lines: `
Lined Seahorse|Hippocampus erectus|S|rare|gold/yellow/gold|hstripes|brown|S
Kuda Seahorse|Hippocampus kuda|S|rare|black/brown/black|none||S
Zebra Seahorse|Hippocampus zebra|S|legendary|white/white/white|zebra|black|S
Dwarf Seahorse|Hippocampus zosterae|S|ultra|tan/cream/tan|none||S
Bluestripe Pipefish|Doryrhamphus excisus|S|rare|orange/gold/orange|hstripes|blue|-|eel
Dragonface Pipefish|Corythoichthys haematopterus|S|uncommon|tan/cream/tan|vbands|red|-|eel
Leafy Seadragon|Phycodurus eques|M|legendary|gold/yellow/green|marble|olive|S
Weedy Seadragon|Phyllopteryx taeniolatus|M|legendary|red/yellow/violet|spots|yellow|S
`
	},
	{
		head: 'salt tropical fish rock,coral',
		lines: `
Yellow Tail Damsel (Captive Bred)|Chrysiptera parasema|S|common|blue/blue/blue|split|yellow
Sixbar Wrasse|Thalassoma hardwicke|M|common|green/teal/green|vbands|black
Bluestreak Cleaner Wrasse|Labroides dimidiatus|S|common|blue/white/blue|hstripes|black
Midnight Angelfish|Centropyge nox|S|uncommon|black/black/black|none|
Hawaiian Black Triggerfish|Melichthys niger|L|uncommon|navy/navy/navy|none||P
Blue Throat Wrasse|Pseudocheilinus sp.|S|rare|blue/teal/blue|hstripes|orange
Snowflake Damselfish|Chrysiptera rex|S|uncommon|gold/cream/gold|none|
Orange-spotted Filefish|Oxymonacanthus longirostris|S|rare|teal/green/teal|spots|orange|-|tall
Scooter Dragonet|Synchiropus ocellatus|S|uncommon|tan/cream/tan|spots|white|-|bottom
Bicolor Goatfish|Parupeneus barberinoides|M|uncommon|red/yellow/red|split|yellow
Dottyback Mix (Captive Bred)|Pseudochromis sp.|S|common|orange/yellow/orange|none|
Yellow Assessor|Assessor flavissimus|S|uncommon|yellow/yellow/yellow|none|
Blue Assessor|Assessor macneilli|S|rare|navy/blue/navy|none|
Comet (Marine Betta)|Calloplesiops altivelis|M|rare|navy/black/navy|spots|white|P|betta
Vlamingi Tang|Naso vlamingii|XL|rare|gray/navy/gray|spots|cyan|-|tall
Unicorn Tang|Naso unicornis|XL|uncommon|gray/cream/gray|none||-|tall
`
	},
	// ── The clean-up crew: shrimp, snails and crabs that graze algae and eat leftovers (flag C).
	// Each one in a tank slows how fast it gets dirty. Big fish see shrimp as snacks, so the
	// usual predator check applies.
	{
		head: 'fresh tropical shrimp plants,wood C',
		lines: `
Cherry Shrimp|Neocaridina davidi|S|common|#d8202a/#e84848/#c01820|none|
Blue Dream Shrimp|Neocaridina davidi (blue dream)|S|uncommon|#1a3ab0/#2a50c8/#142a90|none|
Yellow Goldenback Shrimp|Neocaridina davidi (yellow)|S|common|#f0c818/#f8d840/#d8b010|none|
Orange Sakura Shrimp|Neocaridina davidi (orange)|S|common|#f07818/#f89040/#d86010|none|
Green Jade Shrimp|Neocaridina davidi (green jade)|S|uncommon|#2a8a3a/#3aa04a/#1a7030|none|
Chocolate Shrimp|Neocaridina davidi (chocolate)|S|uncommon|#5a2a18/#6a3a28/#4a2010|none|
Black Rose Shrimp|Neocaridina davidi (black rose)|S|rare|#141418/#222228/#0a0a0e|none|
Amano Shrimp|Caridina multidentata|S|common|#c8b8a0/#d8ccb8/#b0a088|spots|#5a4a3a
Ghost Shrimp|Palaemonetes paludosus|S|common|#d8e0e0/#e8f0f0/#c0cccc|none|
Crystal Red Shrimp|Caridina cantonensis (crystal red)|S|rare|#f4f4f4/#ffffff/#e8e8e8|vbands|#d01828
Crystal Black Shrimp|Caridina cantonensis (crystal black)|S|rare|#f4f4f4/#ffffff/#e8e8e8|vbands|#141418
Blue Bolt Shrimp|Caridina cantonensis (blue bolt)|S|epic|#6ab8f0/#a8d8f8/#4a98d8|split|#f4f8fc
King Kong Shrimp|Caridina cantonensis (king kong)|S|ultra|#141418/#202028/#0a0a0e|none|
Tiger Shrimp|Caridina mariae|S|uncommon|#c8a878/#d8c098/#a88858|zebra|#2a2018
Orange Eye Blue Tiger Shrimp|Caridina mariae (blue tiger)|S|rare|#2a48b8/#3a5ac8/#1a3898|zebra|#0a1440
Cardinal Shrimp|Caridina dennerli|S|epic|#c81828/#d83040/#a01020|spots|#f4f4f4
Bamboo Shrimp|Atyopsis moluccensis|M|uncommon|#a87848/#c09060/#906038|hstripes|#e8d8b8
Vampire Shrimp|Atya gabonensis|M|rare|#5a6a88/#7a88a0/#4a5878|none|
`
	},
	{
		head: 'fresh tropical snail plants,rock C',
		lines: `
Zebra Nerite Snail|Neritina natalensis|S|common|#d8a828/#c09020/#3a2a10|zebra|#1a1408
Horned Nerite Snail|Clithon corona|S|common|#d8c068/#c0a850/#2a2010|vbands|#1a1408
Olive Nerite Snail|Neritina reclivata|S|common|#5a6a28/#4a5a20/#3a4818|none|
Red Racer Nerite Snail|Vittina waigiensis|S|uncommon|#d84818/#c03810/#5a2010|zebra|#1a1408
Gold Mystery Snail|Pomacea bridgesii|S|common|#f0c030/#e8b020/#d8c8a0|none|
Blue Mystery Snail|Pomacea bridgesii (blue)|S|uncommon|#3a5a98/#2a4a88/#b8c0c8|none|
Ivory Mystery Snail|Pomacea bridgesii (ivory)|S|uncommon|#f4ecd8/#e8e0c8/#f0e8d8|none|
Magenta Mystery Snail|Pomacea bridgesii (magenta)|S|rare|#c8487a/#b8386a/#e0c8b8|none|
Red Ramshorn Snail|Planorbella duryi|S|common|#c83028/#b02820/#d84838|none|
Malaysian Trumpet Snail|Melanoides tuberculata|S|common|#8a7058/#7a6048/#6a5040|spots|#3a2818
Yellow Rabbit Snail|Tylomelania zemis|M|rare|#3a2818/#2a1c10/#f0c818|vbands|#5a4028
`
	},
	{
		head: 'fresh cold snail gravel,plants C',
		lines: `
Japanese Trapdoor Snail|Cipangopaludina japonica|S|uncommon|#4a4030/#3a3020/#2a2418|hstripes|#2a2010
`
	},
	{
		head: 'salt tropical shrimp rock,coral C',
		lines: `
Skunk Cleaner Shrimp|Lysmata amboinensis|S|uncommon|#e84818/#f06030/#f4f4f4|split|#f4f4f4
Fire Shrimp|Lysmata debelius|S|rare|#c81020/#d82030/#f4f4f4|spots|#f4f4f4
Peppermint Shrimp|Lysmata wurdemanni|S|common|#e88878/#f0a090/#d87060|hstripes|#c02020
Coral Banded Shrimp|Stenopus hispidus|S|uncommon|#f4f4f4/#ffffff/#e8e8e8|vbands|#c81828
Sexy Shrimp|Thor amboinensis|S|rare|#d86818/#e88030/#f4f4f4|spots|#f4f4f4
`
	},
	{
		head: 'salt tropical snail rock,sand C',
		lines: `
Turbo Snail|Turbo fluctuosa|S|common|#6a5a40/#5a4a30/#c8b888|marble|#3a3020
Astraea Snail|Lithopoma tectum|S|common|#a89878/#988868/#d8c8a8|vbands|#7a6a50
Cerith Snail|Cerithium atratum|S|common|#4a4038/#3a3028/#c8c0b0|spots|#e8e0d0
Nassarius Snail|Nassarius vibex|S|common|#8a7a68/#7a6a58/#e8e0d0|marble|#5a4a38
Bumble Bee Snail|Engina mendicaria|S|uncommon|#141418/#202028/#f0d818|hstripes|#f0d818
Fighting Conch|Strombus alatus|M|uncommon|#c87838/#b86828/#f0d8b0|marble|#8a4818
Tiger Cowrie|Cypraea tigris|M|rare|#f0e8d8/#e8dcc8/#5a4028|spots|#2a1c10
`
	},
	{
		head: 'salt tropical crab rock,coral C',
		lines: `
Emerald Crab|Mithraculus sculptus|S|common|#2a8a3a/#3aa04a/#1a6a2a|none|
Blue Leg Hermit Crab|Clibanarius tricolor|S|common|#c87838/#b86828/#2a6ac8|none|
Scarlet Reef Hermit Crab|Paguristes cadenati|S|uncommon|#c81828/#d83040/#f0d818|none|
Halloween Hermit Crab|Ciliopagurus strigatus|S|rare|#e85818/#f07030/#c81828|vbands|#c81828
Sally Lightfoot Crab|Percnon gibbesi|S|uncommon|#5a3a28/#6a4a38/#e8c818|hstripes|#e8c818
`
	}
];
