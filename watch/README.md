# Your tracked cards

One file per card, named after its TCGdex id, e.g. `swsh7-215.json`. Contents are optional:

```json
{ "qty": 1, "cost": 450, "variant": "normal" }
```

- `qty`: how many you own (defaults to 1)
- `cost`: what you paid per card, in pounds
- `variant`: `normal` (Cardmarket trend) or `holo` (Cardmarket reverse holo price)

The site's "Add card" button opens GitHub with this file filled in; commit it and the price job runs within a few minutes. Delete the file to stop tracking.
