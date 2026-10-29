# Slag

A card-shedding game for 2 to 8 players. Match the target number, dump your cards, and keep your score low.

This repo is a playable web version: you against 1 to 7 computer players at a forge-lit table. Open `index.html` in a browser, or play the hosted copy on Render.

## How a round works

1. A target card sits in the middle. Everyone secretly picks up to 3 cards that add up exactly to its number. At most one may be a negative. You may pass instead.
2. Everyone reveals at once. If nobody made the number, the deal ends.
3. The best play wins the round (see "Who wins a round" below).
4. Everyone who made the number discards those cards. Anyone who passed or missed draws one penalty card, which they can't use until the next round.
5. The round winner picks a card from their hand to be the next target. That card leaves their hand.

The deal ends when someone runs out of cards or nobody can make the target.

## Who wins a round

The game offers two rules on the setup screen.

**Most of the color** (default)
1. The play with the most cards of the target's color wins. Negatives of that color count.
2. Tied? The highest card of the target's color wins.
3. Still tied, or nobody played the color? The highest card wins, then the target's sister suit, then suit rank, then the starred copy.

**Highest card**
Any card of the target's color beats every other color, and the highest one wins. Ties fall to the sister suit, then suit rank, then the starred copy.

Sister suits: Red & Orange, Green & Blue, Purple & Grey.
Suit rank: Red 6, Orange 5, Green 4, Blue 3, Purple 2, Grey 1.

## Scoring

- Positive cards score their value.
- Each negative scores +5, unless it pairs with a positive card of the same suit in your hand. Then it subtracts its value instead (Blue 8 + Blue −3 = 5).
- Black negatives never pair.
- Lowest score wins. Play three deals, or play until someone reaches 50.

## Setup by player count

| Players | Main deck | Cards each | Negative sets |
| --- | --- | --- | --- |
| 2 | Red, Orange, Green, Blue, no doubles (40) | 11 | Those 4 suits |
| 3–4, Most of the color | All six suits, Purple and Grey with no doubles (80) | 11 | All six suits |
| 3–4, Highest card | All six suits, Purple and Grey 6–10 only (70) | 11 | All six suits |
| 5–6 | All six suits (90) | 11 | All six suits |
| 7 | All six suits (90) | 11 | Six suits + 1 black |
| 8 | All six suits (90) | 10 | Six suits + 2 black |

Each suit runs 1–10 with two copies of 1–5; one copy of each doubled card carries a star. Every player starts with one −1, −2 and −3 dealt from the negative piles.

When the draw pile runs out, shuffle the discards into a new draw pile. With 2 players, the first time nobody can make the target, flip a new target instead of ending the deal.

## Files

- `index.html`: the whole game (rules engine, computer players and table), no build step
- `cards/`: card artwork
