# Your tracked cards

One file per card, named after its TCGdex id, e.g. `swsh7-215.json`. Contents are optional:

```json
{ "qty": 1, "cost": 450, "variant": "normal", "edition": "1st", "note": "Bought at a car boot sale" }
```

- `qty`: how many you own (defaults to 1)
- `cost`: what you paid per card, in pounds
- `variant`: `normal` (Cardmarket price) or `holo` (Cardmarket reverse holo price)
- `edition`: set to `1st` for a 1st Edition card; it is then priced from TCGplayer's (US) 1st Edition market price, converted to pounds
- `note`: a short note shown under the card

The site's "Add card" button opens GitHub with this file filled in; commit it and the price job runs within a few minutes. Delete the file to stop tracking.
