for (const id of ['gym1-2','gym1-41','base1-4']) { const c = await (await fetch('https://api.tcgdex.net/v2/en/cards/'+id)).json(); console.log(id, JSON.stringify(c.pricing)); }
