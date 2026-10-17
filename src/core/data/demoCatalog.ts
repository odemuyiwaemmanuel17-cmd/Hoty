import type { Product, ProductOption } from './catalogTypes'
import { CINEMATIC } from '../../assets/cinematic/assetManifest'

/**
 * CLEARLY-LABELLED DEMO CATALOG — used only until Firebase is connected.
 * Every product carries `demo: true`; the UI shows a "DEMO" badge and the
 * checkout message states prices are unconfirmed. These are NOT the
 * restaurant's real items or prices.
 */

export const DEMO_OPTIONS: ProductOption[] = [
  // Fillings (required, pick 1)
  { id: 'opt-fill-chicken', groupId: 'grp-filling', name: 'Chicken', priceKobo: 0, assetKey: 'meat-chicken' },
  { id: 'opt-fill-beef', groupId: 'grp-filling', name: 'Beef', priceKobo: 30000, assetKey: 'meat-beef' },
  { id: 'opt-fill-mixed', groupId: 'grp-filling', name: 'Mixed', priceKobo: 50000, assetKey: 'meat-mixed' },
  // Sauces (pick up to 2)
  { id: 'opt-sauce-garlic', groupId: 'grp-sauce', name: 'Garlic toum', priceKobo: 0, assetKey: 'sauce-garlic' },
  { id: 'opt-sauce-hot', groupId: 'grp-sauce', name: 'Pepper sauce', priceKobo: 0, assetKey: 'sauce-hot', incompatibleWith: ['opt-sauce-tahini'] },
  { id: 'opt-sauce-tahini', groupId: 'grp-sauce', name: 'Tahini', priceKobo: 10000, assetKey: 'sauce-tahini', incompatibleWith: ['opt-sauce-hot'] },
  // Extras (pick up to 2)
  { id: 'opt-extra-fries', groupId: 'grp-extra', name: 'Fries inside', priceKobo: 20000, assetKey: 'extra-fries' },
  { id: 'opt-extra-cheese', groupId: 'grp-extra', name: 'Cheese', priceKobo: 30000, assetKey: 'extra-cheese' },
  // Size (required, pick 1)
  { id: 'opt-size-regular', groupId: 'grp-size', name: 'Regular', priceKobo: 0, assetKey: 'size-regular' },
  { id: 'opt-size-large', groupId: 'grp-size', name: 'Large (jumbo)', priceKobo: 80000, assetKey: 'size-large' },
]

export const DEMO_PRODUCTS: Product[] = [
  {
    id: 'demo-shawarma-custom',
    name: 'Build-Your-Own Shawarma',
    description: 'Demo product — choose filling, sauces, extras and size.',
    priceKobo: 250000,
    currency: 'NGN',
    category: 'Wraps',
    available: true,
    demo: true,
    image: CINEMATIC.products['demo-shawarma-custom'].url,
    groups: [
      { id: 'grp-filling', name: 'Filling', min: 1, max: 1, optionIds: ['opt-fill-chicken', 'opt-fill-beef', 'opt-fill-mixed'] },
      { id: 'grp-sauce', name: 'Sauces', min: 0, max: 2, optionIds: ['opt-sauce-garlic', 'opt-sauce-hot', 'opt-sauce-tahini'] },
      { id: 'grp-extra', name: 'Extras', min: 0, max: 2, optionIds: ['opt-extra-fries', 'opt-extra-cheese'] },
      { id: 'grp-size', name: 'Size', min: 1, max: 1, optionIds: ['opt-size-regular', 'opt-size-large'] },
    ],
  },
  {
    id: 'demo-chicken-wrap',
    name: 'Classic Chicken Wrap',
    description: 'Demo product — fixed recipe, no options.',
    priceKobo: 280000,
    currency: 'NGN',
    category: 'Wraps',
    available: true,
    demo: true,
    image: CINEMATIC.products['demo-chicken-wrap'].url,
},
  {
    id: 'demo-beef-wrap',
    name: 'Beef & Garlic Wrap',
    description: 'Demo product — fixed recipe, no options.',
    priceKobo: 320000,
    currency: 'NGN',
    category: 'Wraps',
    available: true,
    demo: true,
    image: CINEMATIC.products['demo-beef-wrap'].url,
},
  {
    id: 'demo-plate',
    name: 'Shawarma Plate',
    description: 'Demo product — plated serving.',
    priceKobo: 450000,
    currency: 'NGN',
    category: 'Plates',
    available: true,
    demo: true,
    image: CINEMATIC.products['demo-plate'].url,
},
  {
    id: 'demo-mixed-jumbo',
    name: 'Jumbo Mixed Wrap',
    description: 'Demo product — temporarily unavailable (availability flow test).',
    priceKobo: 420000,
    currency: 'NGN',
    category: 'Wraps',
    available: false,
    demo: true,
    image: CINEMATIC.products['demo-mixed-jumbo'].url,
},
]
