const RETAILER_DOMAINS: Record<string, string> = {
  'Acme Markets': 'acmemarkets.com',
  Albertsons: 'albertsons.com',
  'Capitola Mall': 'shopcapitolamall.com',
  'Food 4 Less': 'food4less.com',
  FoodMaxx: 'foodmaxx.com',
  'Fred Meyer': 'fredmeyer.com',
  Frys: 'frysfood.com',
  "Gelson's Market": 'gelsons.com',
  'H Mart Federal Way': 'hmart.com',
  'H Mart Lynnwood': 'hmart.com',
  'H Mart Niles': 'hmart.com',
  'H Mart Redmond': 'hmart.com',
  'H Mart Tigard': 'hmart.com',
  'H-E-B': 'heb.com',
  'Harris Teeter': 'harristeeter.com',
  'Jewel-Osco': 'jewelosco.com',
  'King Soopers': 'kingsoopers.com',
  Kroger: 'kroger.com',
  'Lucky Supermarkets': 'luckysupermarkets.com',
  "Mariano's Fresh Market": 'marianos.com',
  'Metro Market': 'metromarket.net',
  'Pak N Save': 'safeway.com',
  Pavilions: 'pavilions.com',
  'Payless Foods': 'paylessfoods.com',
  "Pick 'n Save": 'picknsave.com',
  QFC: 'qfc.com',
  Ralphs: 'ralphs.com',
  Randalls: 'randalls.com',
  Safeway: 'safeway.com',
  "Shaw's": 'shaws.com',
  "Smith's": 'smithsfoodanddrug.com',
  'Star Market': 'starmarket.com',
  'Sunrise Mall': 'sunrisemall.com',
  'Tanger Outlets Antioch': 'tangeroutlets.com',
  'The Commons at Federal Way': 'shopthecommonsmall.com',
  'Tom Thumb': 'tomthumb.com',
  Vons: 'vons.com',
  'WestField Southcenter': 'westfield.com',
  'WinCo Foods': 'wincofoods.com',
  "Woodman's Market": 'woodmans-food.com',
};

const FALLBACK_LOGO = 'https://www.google.com/s2/favicons?domain=pokemoncenter.com&sz=128';

export function getRetailerLogo(store: string): string {
  const domain = RETAILER_DOMAINS[store];
  if (!domain) return FALLBACK_LOGO;
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
}
