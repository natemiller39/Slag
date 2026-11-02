# Slag

A card-shedding game for 2 to 8 players. Match the target number, dump your cards, and keep your score low.

This repo is a playable web version at a forge-lit table. Play against 1 to 7 computer players, or host an online game with friends.

## Playing online

1. On the start screen, enter your name and choose **Host a game**. You get a 4-letter room code and an invite link.
2. Friends open the link, or enter the code and choose **Join**. Up to 8 seats.
3. The host can add bots to fill seats, choose the rules, and deal.
4. Everyone picks their cards privately; plays are revealed together once everyone has locked in.
5. If someone drops out, a bot plays their seat until they come back. Reopening the page rejoins the same seat.

The server (`server.js`) deals and holds every hand, so nobody can see another player's cards.

## How a round works

1. A target card sits in the middle. Everyone secretly picks up to 3 cards that add up exactly to its number. At most one may be a negative. You may pass instead.
2. Everyone reveals at once. If nobody made the number, the deal ends.
3. The best play wins the round (see "Who wins a round" below).
4. Everyone who made the number discards those cards. Anyone who passed or missed draws one penalty card, which they can't use until the next round.
5. The round winner picks a card from their hand to be the next target. That card leaves their hand.

The deal ends when someone runs out of cards or nobody can make the target.

## Who wins a round

The game offers two rules on the setup screen.

**Highest card** (default)
Any card of the target's color beats every other color, and the highest one wins. Ties fall to the sister suit, then suit rank, then the starred copy.

**Most of the color**
1. The play with the most cards of the target's color wins. Negatives of that color count.
2. Tied? The highest card of the target's color wins.
3. Still tied, or nobody played the color? The highest card wins, then the target's sister suit, then suit rank, then the starred copy.

Sister suits: Red & Orange, Green & Blue, Purple & Grey.
Suit rank: Red 6, Orange 5, Green 4, Blue 3, Purple 2, Grey 1.

## Option: Quench cards

Turn on **Quench cards** on the start screen or in the lobby to shuffle 0-value Quench cards into the deck: 1 at 2–3 players, 2 at 4–5, 3 at 6–8.

- Add a Quench to a play that makes the number. It counts as one of your 3 cards and can't be played alone.
- When a Quench is revealed, nobody wins the round. Everyone who made the number still discards, misses still draw, and a new target is flipped instead of being chosen by a winner.
- A Quench never becomes the target: if one is flipped, it goes under the draw pile and the next card is flipped.
- A Quench drawn as a penalty goes into your hand like any other card.
- One still in your hand at the end of a deal scores +5.
- If a Quench is played when the draw pile is empty, the deal ends.

## Option: Usurper cards

Turn on **Usurper cards** on the start screen or in the lobby to shuffle three Usurpers, worth 3, into the deck: one for each sister pair (Red/Orange, Green/Blue, Purple/Grey). With 2 players, only the Red/Orange and Green/Blue Usurpers are used.

- **Taking the round:** when the target is one of a Usurper's two colors, play it alongside a positive card of the target's color and you take the round outright. Only one Usurper can match any target, so two players can never both take the round.
- **Otherwise:** it's just a plain 3 with no color. It doesn't change who wins.
- **As the target:** it has no color, so the highest single card wins. The Usurper itself never counts as the high card. If the top plays tie on that card, nobody wins: everyone who made the number still discards, misses still draw, and a new target is flipped.
- A Quench still beats everything: if both are played, nobody wins.
- A winner can set a Usurper as the next target.
- Left in your hand at the end of a deal, it scores 3.

## Option: Slag card

Turn on **Slag card** on the start screen or in the lobby to shuffle one colorless Slag card, worth 7, into the deck.

- **Played in a combo:** whoever wins that round draws a penalty card, unless it's you. The Slag card never counts as your high card. Because it's worth 7, you can only play it when the target is 4 or higher (7 alone, 7 with a negative, or 7 plus other cards).
- **As the target:** make 7. Color doesn't count, the best play wins, and the winner draws a penalty card. So everyone wants to make 7 to shed cards, but nobody wants the best play.
- A round winner can set the Slag card as the next target, which gets it out of their hand and passes the curse along.
- If a Quench is played the same round, nobody wins, so nobody gets burned.
- If the winner goes out that round, the deal ends before they would draw.
- Stuck with it at the end of a deal, it scores 7.

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

- `index.html`: the game screens: start screen, lobby and table
- `engine.js`: the rules engine and computer players, shared by the page and the server
- `server.js`: serves the page and runs online games over WebSockets
- `cards/`: card artwork

## Running it yourself

```
npm install
npm start
```

Then open http://localhost:3000. On Render this runs as a Node web service with build command `npm install` and start command `npm start`.
