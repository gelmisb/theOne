// What the photos are, in one place: the captions the homepage Portfolio and the
// Photography page both show, and which photos the Photography gallery displays
// and in what order. Each caption describes what is actually in the picture -
// several old ones were wrong because a photo had been swapped under a
// filename that still named the previous shot (a welder labelled "Gym Coaching
// Session", a juice stall labelled "Strength Training").
//
// Adding a photo to the gallery takes two edits: its file in the right group
// below, and the same filename in the literal glob in components/PhotoGallery.astro
// (Vite needs a literal pattern, and listing files explicitly is deliberate - an
// imported image is published whether or not it's shown, which is how excluded
// photos once reached the public build).

/** Caption by filename. Files not listed fall back to a name derived from the
 *  filename, which reads badly for camera-roll or double-extension names. */
export const PHOTO_CAPTIONS: Record<string, string> = {
  // Cafés, shops, trades, events
  'Barbershops.jpg': 'Barbershop',
  'IMG_0863.jpg': 'Coffee Break',
  'IMG_4721.jpg': 'Costa Corner',
  'IMG_0839.jpg': 'Welder at Work',
  'IMG_1643.jpg': 'Local Produce',
  'consumables.jpg': 'Gin and Tonic at Dusk',
  'product advertisement.jpg': 'Gin Glass Product Shot',
  'IMG_1436.JPG': 'Milan Galleria',
  // Portraits and lifestyle
  'motorcycle-rider.jpg': 'Golden Hour Portrait',
  'IMG_3033.jpg': 'Motorcycle Feature',
  'gelmis-bartulis-aFjxblNID7Y-unsplash.jpg': 'Portrait Session',
  'gelmis-bartulis-UaFUhxyGNFY-unsplash.jpg': 'Touring Motorcycle',
  // Pet shops
  'village-pet-shop-front.webp.webp': 'Village Pet Shop Front',
  'furry-buts-buddy-care.webp.webp': 'Furry Butts - Buddy Care',
  'furry-buts-goods.webp.webp': 'Furry Butts - Goods',
  // Furry Butts, Blessington (event and shop shoot)
  'furry-butts-window-mural.jpg': 'Shop Window Mural',
  'furry-butts-dog-treat.jpg': 'Dog Taking a Treat',
  'furry-butts-treat-jars.jpg': 'Treat Jar Display',
  'furry-butts-snake.jpg': 'Snake Close-Up',
  'furry-butts-gift-bag.jpg': 'Gift Bag Styling',
  'furry-butts-gift-bag-wide.jpg': 'Gift Bag, Wider View',
  'furry-butts-grooming-shelf.jpg': 'Grooming Shelf',
  'furry-butts-pet-portraits.jpg': 'Framed Pet Portraits',
  'furry-butts-popcorn.jpg': 'Popcorn at the Event',
  'furry-butts-supplements.jpg': 'Pet Wellness Shelf',
  'furry-butts-dog-food.jpg': 'Dog Food Bags',
};

export interface GalleryGroup {
  id: string;
  title: string;
  note?: string;
  /** Filenames, in display order. */
  files: string[];
}

export const galleryGroups: GalleryGroup[] = [
  {
    id: 'furry-butts',
    title: 'Furry Butts, Blessington',
    note: 'Event and shop photography for a local pet shop - in progress.',
    files: [
      'furry-butts-window-mural.jpg',
      'furry-butts-dog-treat.jpg',
      'furry-butts-treat-jars.jpg',
      'furry-butts-snake.jpg',
      'furry-butts-gift-bag.jpg',
      'furry-butts-pet-portraits.jpg',
      'furry-butts-grooming-shelf.jpg',
      'furry-butts-popcorn.jpg',
      'furry-butts-supplements.jpg',
      'furry-butts-gift-bag-wide.jpg',
      'furry-butts-dog-food.jpg',
    ],
  },
  {
    id: 'shops-cafes-trades',
    title: 'Shops, cafés and trades',
    note: 'On-location work across food and drink, retail and trades.',
    files: [
      'Barbershops.jpg',
      'IMG_0863.jpg',
      'IMG_4721.jpg',
      'IMG_0839.jpg',
      'IMG_1643.jpg',
      'consumables.jpg',
      'product advertisement.jpg',
    ],
  },
  {
    id: 'portraits',
    title: 'Portraits and lifestyle',
    note: 'Portrait and lifestyle work, including some personal shoots.',
    files: ['motorcycle-rider.jpg', 'IMG_3033.jpg', 'gelmis-bartulis-aFjxblNID7Y-unsplash.jpg'],
  },
];
